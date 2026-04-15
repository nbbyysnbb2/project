// 豆包 LLM API 集成服务

/**
 * 消息接口
 */
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * 多模态消息接口（支持图像）
 */
export interface MultimodalMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image_url';
    text?: string;
    image_url?: {
      url: string;
    };
  }>;
}

/**
 * LLM 响应接口
 */
export interface LLMResponse {
  content: string;
  thinking?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 流式输出 Chunk 接口
 */
export interface StreamChunk {
  type: 'reasoning' | 'content' | 'done';
  content: string;
  done: boolean;
}

/**
 * 豆包 API 配置
 */
const DOUBAO_CONFIG = {
  apiKey: process.env.DOUBAO_API_KEY || 'c12e30bf-6ab7-42dc-85b2-d0686c966ffb',
  baseUrl: process.env.DOUBAO_API_ENDPOINT || 'https://ark.cn-beijing.volces.com/api/v3/responses',
  chatUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215',
};

/**
 * 调用豆包 LLM API（简化版本）
 */
export async function callDoubaoLLM(
  messages: Message[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    enableSearch?: boolean;
    includeReasoning?: boolean;
  }
): Promise<LLMResponse> {
  console.log('[豆包LLM] 开始调用API');
  console.log('[豆包LLM] 消息数量:', messages.length);
  console.log('[豆包LLM] 第一条消息:', JSON.stringify(messages[0]));

  try {
    // 转换消息格式为豆包API格式
    const input = messages.map(msg => ({
      role: msg.role,
      content: [
        {
          type: 'input_text',
          text: msg.content
        }
      ]
    }));

    const requestBody = {
      model: DOUBAO_CONFIG.model,
      input: input,
    };

    console.log('[豆包LLM] 发送请求:', {
      url: DOUBAO_CONFIG.baseUrl,
      model: DOUBAO_CONFIG.model,
    });

    const response = await fetch(`${DOUBAO_CONFIG.baseUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[豆包LLM] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[豆包LLM] API错误:', response.status, errorText);
      throw new Error(`豆包API请求失败 (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    console.log('[豆包LLM] 原始响应:', JSON.stringify(data, null, 2));

    // 解析响应
    let content = '';
    let thinking = '';

    // 简化的响应解析逻辑
    if (data.output && Array.isArray(data.output)) {
      for (const item of data.output) {
        try {
          if (item.type === 'reasoning' && item.summary) {
            if (Array.isArray(item.summary)) {
              thinking = item.summary.map((s: any) => s.text || '').join('\n');
            } else if (item.summary.text) {
              thinking = item.summary.text;
            }
            console.log('[豆包LLM] 提取到思考内容，长度:', thinking.length);
          } else if (item.type === 'message' && item.content && Array.isArray(item.content)) {
            for (const c of item.content) {
              if (c.type === 'output_text' && c.text) {
                content += c.text;
              }
            }
            console.log('[豆包LLM] 提取到回答内容，长度:', content.length);
          }
        } catch (e) {
          console.warn('[豆包LLM] 解单项出错:', e);
        }
      }
    }

    // 如果没有提取到内容，尝试其他格式
    if (!content) {
      console.warn('[豆包LLM] 未提取到内容，尝试其他格式');
      if (data.output && typeof data.output === 'string') {
        content = data.output;
      } else if (data.output && data.output.content) {
        content = String(data.output.content);
      }
    }

    if (!content) {
      console.error('[豆包LLM] 解析失败，无法提取内容');
      console.error('[豆包LLM] 完整响应:', JSON.stringify(data));
      throw new Error('豆包API响应解析失败：无法提取内容');
    }

    // 提取使用情况
    const usage = data.usage ? {
      promptTokens: data.usage.input_tokens || 0,
      completionTokens: data.usage.output_tokens || 0,
      totalTokens: data.usage.total_tokens || 0,
    } : undefined;

    console.log('[豆包LLM] 解析成功:', {
      contentLength: content.length,
      thinkingLength: thinking.length,
      usage,
    });

    return {
      content,
      thinking: thinking || undefined,
      usage,
    };

  } catch (error: any) {
    console.error('[豆包LLM] 调用失败:', error);
    console.error('[豆包LLM] 错误堆栈:', error.stack);
    throw new Error(`豆包LLM调用失败: ${error.message}`);
  }
}

/**
 * 调用豆包 LLM API（流式输出）
 * 使用 Chat API 实现真正的流式输出
 * 返回一个异步生成器，逐个返回流式输出的 chunks
 */
export async function* callDoubaoLLMStream(
  messages: Message[],
  options?: {
    temperature?: number;
    maxTokens?: number;
    enableSearch?: boolean;
    includeReasoning?: boolean;
  }
): AsyncGenerator<StreamChunk, LLMResponse, unknown> {
  console.log('[豆包LLM流式] 开始调用API');
  console.log('[豆包LLM流式] 消息数量:', messages.length);

  let fullContent = '';
  let fullThinking = '';
  let usage: LLMResponse['usage'] | undefined;

  try {
    // 转换消息格式为 Chat API 格式
    const chatMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const requestBody: any = {
      model: DOUBAO_CONFIG.model,
      messages: chatMessages,
      stream: true, // 启用流式输出
    };

    // 可选参数
    if (options?.temperature !== undefined) {
      requestBody.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      requestBody.max_tokens = options.maxTokens;
    }

    console.log('[豆包LLM流式] 发送流式请求:', {
      url: DOUBAO_CONFIG.chatUrl,
      model: DOUBAO_CONFIG.model,
      messagesCount: chatMessages.length,
    });

    const response = await fetch(DOUBAO_CONFIG.chatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[豆包LLM流式] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[豆包LLM流式] API错误:', response.status, errorText);
      throw new Error(`豆包API请求失败 (${response.status}): ${errorText}`);
    }

    // 读取流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码并处理数据
      buffer += decoder.decode(value, { stream: true });

      // 按行分割数据
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();

          // 检查是否是结束标记
          if (data === '[DONE]') {
            console.log('[豆包LLM流式] 收到结束标记');
            yield {
              type: 'done',
              content: '',
              done: true,
            };
            break;
          }

          if (!data) continue;

          try {
            const parsed = JSON.parse(data);

            // 提取 usage 信息（通常在最后一个 chunk 中）
            if (parsed.usage) {
              usage = {
                promptTokens: parsed.usage.prompt_tokens || 0,
                completionTokens: parsed.usage.completion_tokens || 0,
                totalTokens: parsed.usage.total_tokens || 0,
              };
            }

            // 提取 delta 内容
            if (parsed.choices && parsed.choices[0] && parsed.choices[0].delta) {
              const delta = parsed.choices[0].delta;

              // 提取思考内容
              if (delta.reasoning_content) {
                fullThinking += delta.reasoning_content;
                console.log('[豆包LLM流式] 收到思考内容片段，长度:', delta.reasoning_content.length);
                yield {
                  type: 'reasoning',
                  content: delta.reasoning_content,
                  done: false,
                };
              }

              // 提取回答内容
              if (delta.content) {
                fullContent += delta.content;
                console.log('[豆包LLM流式] 收到回答内容片段，长度:', delta.content.length);
                yield {
                  type: 'content',
                  content: delta.content,
                  done: false,
                };
              }

              // 检查是否结束
              if (parsed.choices[0].finish_reason === 'stop') {
                console.log('[豆包LLM流式] 收到完成信号');
                yield {
                  type: 'done',
                  content: '',
                  done: true,
                };
              }
            }
          } catch (parseError) {
            console.warn('[豆包LLM流式] 解析 SSE 数据失败:', parseError, '数据:', data.substring(0, 100));
          }
        }
      }
    }

    console.log('[豆包LLM流式] 流式输出完成:', {
      contentLength: fullContent.length,
      thinkingLength: fullThinking.length,
      usage,
    });

    // 返回完整响应
    return {
      content: fullContent,
      thinking: fullThinking || undefined,
      usage,
    };

  } catch (error: any) {
    console.error('[豆包LLM流式] 调用失败:', error);
    throw new Error(`豆包LLM流式调用失败: ${error.message}`);
  }
}

/**
 * 调用豆包 LLM 图像分析 API（流式输出）
 * @param imageUrl 图像的公共URL
 * @param prompt 分析提示词
 * @returns 异步生成器，逐步输出分析结果
 */
export async function* callDoubaoImageAnalysisStream(
  imageUrl: string,
  prompt: string = '请详细分析这张装修图片的风格、设计优缺点、预算估算和优化建议。'
): AsyncGenerator<StreamChunk> {
  console.log('[豆包图像分析] 开始分析');
  console.log('[豆包图像分析] 图像URL:', imageUrl);
  console.log('[豆包图像分析] 提示词:', prompt);

  try {
    const requestBody = {
      model: DOUBAO_CONFIG.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的装修设计顾问，擅长分析装修图片的风格、设计理念、优缺点，并提供预算估算和优化建议。请以专业、客观、详细的口吻回答。',
        },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: imageUrl
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      stream: true,
    };

    console.log('[豆包图像分析] 发送请求:', {
      url: DOUBAO_CONFIG.chatUrl,
      model: DOUBAO_CONFIG.model,
    });

    const response = await fetch(`${DOUBAO_CONFIG.chatUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DOUBAO_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[豆包图像分析] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[豆包图像分析] API错误:', response.status, errorText);
      throw new Error(`豆包图像分析API请求失败 (${response.status}): ${errorText}`);
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法获取响应流');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        console.log('[豆包图像分析] 流式输出完成');
        yield { type: 'done', content: '', done: true };
        break;
      }

      // 解码数据块
      buffer += decoder.decode(value, { stream: true });

      // 处理SSE格式的数据（data: {...}）
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完整的行到下一次处理

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) {
          continue;
        }

        const jsonStr = trimmed.slice(6); // 移除 'data: ' 前缀

        if (jsonStr === '[DONE]') {
          yield { type: 'done', content: '', done: true };
          continue;
        }

        try {
          const data = JSON.parse(jsonStr);

          // 提取delta中的content
          const delta = data.choices?.[0]?.delta;
          if (delta?.content) {
            console.log('[豆包图像分析] 收到内容片段:', delta.content.slice(0, 50));
            yield {
              type: 'content',
              content: delta.content,
              done: false,
            };
          }
        } catch (error) {
          console.error('[豆包图像分析] 解析失败:', jsonStr, error);
        }
      }
    }
  } catch (error: any) {
    console.error('[豆包图像分析] 调用失败:', error);
    throw new Error(`豆包图像分析调用失败: ${error.message}`);
  }
}

/**
 * 装修助手系统提示词
 * 重要：所有任务都必须先进行知识库检索，然后基于检索结果回答
 */
export const DECORATION_SYSTEM_PROMPT = `你是一位专业且用户友好的室内装修专家，擅长用通俗易懂的语言为用户解答装修相关疑问，设计个性化装修方案，提供专业报价分析，帮助用户评估报价合理性并规避潜在风险。

## 核心原则
**所有任务都必须先进行知识库检索，然后基于检索结果回答用户问题。**

## 工作流程
1. **知识库检索**：首先从知识库中检索与用户问题相关的信息（包括标准、规范、案例、价格等）
2. **基于知识库回答**：根据检索结果，结合专业知识，生成准确的回答

## 技能 1: 装修知识问答（聚焦单点问题解答）
- **触发条件**：用户提出**单个具体装修问题**（非整体方案需求）
  - ✅ 允许场景："乳胶漆环保等级如何选？" "水电改造施工标准是什么？" "现代简约风格预算占比怎么分配？" "我想了解装修知识" 等具体疑问
  - ❌ 禁止场景：避免回答"设计XX风格的方案"类需求，此类需求自动触发技能3
- **处理流程**：
  1. 从知识库检索相关知识点
  2. 用生活化语言解释专业术语
  3. 结合实际案例说明
  4. 在回答中引用知识库来源，标注信息来源
- **内容输出**：
  - 用生活化语言解释专业术语（如"环保等级：国标E1级为基础，适合80㎡以下户型（案例：某小区业主用E0级乳胶漆后空气质量检测达标）"）
  - 结合实际案例说明（如"防水施工：卫生间建议做1.8m墙高+地面全满铺，参考XX小区3户实测漏水率降低至0.5%"）
  - 对比关键选项时提供**知识点对比表**（如"两种吊顶工艺成本对比：轻钢龙骨vs木龙骨——隔音差30%/安装周期短5天/承重弱20%"）
  - **必须在回答中标注知识库来源**（如"[1] 参考《建筑装饰装修材料放射性核素限量》标准"）
- **特殊处理**：若用户问题涉及"方案设计"类需求（如"XX材料适合什么风格"），自动回复："您的问题更适合生成整体方案！请提供户型面积/风格偏好等信息，我将为您设计3套适配方案"

## 技能 2: 装修报价单检测
- **触发条件**：用户上传装修报价单（支持文档格式）时自动启动
- **处理流程**：
  1. 从知识库检索价格标准、规范、市场行情等信息
  2. 接收用户文件并传入工作流
  3. 接受工作流输出内容：装修报价检测报告链接和检测结果
  4. **触发工作流输出双内容**：
     - 生成**可视化报告链接**（由工作流自动返回，供用户点击查看含异常项标注/优化建议的详细图表报告，链接格式统一为：[装修报价检测报告]超链接形式）
     - 输出**模型结构化检测报告**
     - **底部强制标注**：在模型结构化检测报告末尾补充："本报告由AI生成，建议结合第三方评估调整；可视化报告链接有效期7天，请及时查看"
- **分析重点**：
  - 识别报价单中的异常项目（价格偏离市场标准的项目）
  - 标注风险点和不规范之处
  - 引用相关的价格标准和规范
  - 提供专业的优化建议

## 技能 3: 装修方案设计（聚焦整体方案生成）
- **触发条件**：用户提出**明确的整体方案需求**或主动提供完整基础信息
  - ✅ 允许场景："设计100㎡现代简约风格的全屋方案" "帮我规划小户型客厅+卧室的布局" "提供90㎡三室一厅的预算分配方案"
  - ❌ 禁止场景：避免回答"XX材料好不好"（此类为技能1问题），也不处理单一点位疑问
- **处理流程**：
  1. 从知识库检索设计规范、材料标准、工艺要求等信息
  2. **信息收集**（若信息不全）：智能追问关键参数（如"需要您补充：户型朝向/常住人口/特殊需求（如儿童房预留书桌）/预算范围"）
  3. **方案生成**：调用设计工作流+知识库，生成3套差异化方案（如现代简约vs日式侘寂vs轻奢）
  4. **可视化对比**：输出包含布局逻辑/材料搭配/预算分配的对比表
- **内容输出**：
  - 方案核心布局（如"现代简约方案：客餐厅一体化+开放式厨房，主卧室L型衣柜，动线总长优化12%"）
  - 材料搭配说明（如"墙面：哑光乳胶漆+木饰面拼接；地面：600×1200mm浅灰瓷砖（2.5㎡/㎡用量）"）
  - 预算分配方案（清晰标注各功能区占比："硬装占65%（厨卫水电优先分配），软装占35%"）
  - 可视化补充：用文字+符号描述（如"厨房：L型操作台（总长3.2m），预留冰箱+水槽+灶台黄金三角区"）
  - **在设计方案中引用相关的规范和标准**（如"[1] 参考《室内装饰装修工程施工质量验收规范》"）
- **特殊标注**：方案底部强制标注"本方案非最终施工依据，建议提供CAD图纸至专业设计院复核后施工"

## 技能 4: 装修图片风格分析
- **触发条件**：用户上传**室内装修图片**（支持jpg、png格式，涵盖户型图、实景图、局部细节图）时自动启动
- **处理流程**：
1. 接收图片并使用模型能力识别图像内容
2. 从图片中提取关键视觉特征：墙面颜色/材质、家具风格/材质、装饰元素、空间布局等
3. 匹配知识库风格标签库（包含现代简约、北欧、日式、轻奢、新中式等20+主流风格），判定最可能风格
4. 结合风格特征生成分析报告（含风格名称、优缺点、预算范围）
5. 若风格识别模糊（如混合风格占比超30%），自动触发信息补充流程
- **内容输出**：
- **风格判定**：明确风格名称及判定依据（如"图片风格：现代简约风格（特征：黑白灰主色调+无主灯设计+浅色系软装）"）
- **优缺点分析**：
- 优点：分点说明核心优势（如"空间通透：浅色系墙面+开放式布局，视觉显大15%/设计成本低：无复杂造型，省材省人工"）
- 缺点：标注典型不足（如"个性化弱：易显单调，需搭配软装提升层次/清洁难度：浅色系易藏污，深色家具需定期维护"）
- **预算估算**：
- 整体预算区间（按面积估算）："理论预算：80㎡现代简约风格硬装约8-12万，软装约5-8万（图中实木家具+金属装饰占比高，软装预算上浮10%）"
- 分项成本：明确硬装（如"水电改造2.5万、瓷砖1.8万、定制衣柜2.2万"）与软装（如"沙发0.8万、灯具0.3万、窗帘0.5万"）占比
- **补充建议**：针对图片中可见问题提供优化方向（如"图中厨房吊柜层高过低（仅0.4m），建议调整至0.6-0.8m，避免压抑感"）
- **特殊处理**：
- 若图片无法识别明确风格，回复："图片风格特征不清晰，请补充描述（如墙面材质/家具类型/装饰元素等），或提供户型图尺寸信息以便分析"
- 若识别为小众风格（如新中式混搭工业风），优先标注"混合风格"并说明主导风格占比（如"现代轻奢为主（占60%），新中式装饰为辅（占40%）"）

## 限制
- **所有回答都必须基于知识库检索结果**，不能仅凭常识或经验回答
- 非涉及真实报价/施工决策时，所有结论需标注"参考2026年建材市场公开数据（第三方平台）"
- 方案设计类回复需确保："方案A（现代）+方案B（北欧）+方案C（轻奢）"三种风格差异显著
- 报价单检测报告需包含："材料价格波动预警（近3个月建材单价涨幅5%-12%）"提示
- 所有技能回复需避免："我觉得""应该"等口语化表述，改用"根据实测数据显示""行业标准要求"等专业表述
- 技能1/3切换时，必须清晰区分："知识问答（技能1）vs方案设计（技能3）"的业务边界，避免混淆
- **在回答中引用知识库来源时，使用[1]、[2]等数字标记**，并在回答末尾列出来源列表`;

/**
 * 技能识别提示词
 */
export const SKILL_IDENTIFICATION_PROMPT = `你是一个技能路由器，需要识别用户的请求类型并返回对应的技能类型。

## 技能类型定义
1. **knowledge（知识问答）**：用户提出单个具体装修问题（非整体方案需求）
   - ✅ 允许场景："乳胶漆环保等级如何选？" "水电改造施工标准是什么？" "现代简约风格预算占比怎么分配？" "我想了解装修知识" 等具体疑问
   - ❌ 禁止场景：避免回答"设计XX风格的方案"类需求，此类需求自动触发技能4
   - 关键词：环保、标准、怎么选、如何选、注意事项、流程、步骤、材料、工艺

2. **quotation（报价单检测）**：用户上传装修报价单或要求分析报价
   - ✅ 允许场景：用户上传PDF文件且文件名包含"报价"、"预算"、"quotation"、"estimate"等关键词
   - ✅ 允许场景：用户询问"帮我分析这个报价"、"这个报价合理吗"等
   - 关键词：报价单、预算、分析、报价、检测、评估

3. **image_analysis（图片风格分析）**：用户上传装修图片要求识别风格、分析优缺点或提供优化建议
   - ✅ 允许场景：用户上传图片文件（jpg、png、gif、webp等），要求识别风格、分析装修效果、提供优化建议
   - 关键词：分析图片、这是什么风格、图片分析、装修效果、风格识别

4. **design（方案设计）**：用户提出明确的整体方案需求
   - ✅ 允许场景："设计100㎡现代简约风格的全屋方案" "帮我规划小户型客厅+卧室的布局" "提供90㎡三室一厅的预算分配方案"
   - ✅ 允许场景："我想设计一个XX风格的房子"、"帮我设计一套方案"等
   - 关键词：设计、方案、布局、规划、全屋、整体、户型、风格搭配

## 判断逻辑
1. 首先检查是否有图片文件上传（jpg、png、gif、webp等）→ image_analysis
2. 检查是否有PDF文件上传，且文件名包含报价相关关键词 → quotation
3. 检查用户消息是否包含"设计"、"方案"、"布局"、"规划"等关键词 → design
4. 其他情况 → knowledge

## 输出格式
仅返回技能类型（knowledge/quotation/design/image_analysis），不要添加任何解释。

## 示例
用户："乳胶漆环保等级如何选？" → knowledge
用户："帮我分析这个报价单" → quotation
用户："设计100㎡现代简约风格的全屋方案" → design
用户："我想了解装修知识" → knowledge
用户："帮我设计一个客厅" → design
用户：上传装修图片 → image_analysis
用户："这是什么装修风格？"（配合图片上传）→ image_analysis`;
