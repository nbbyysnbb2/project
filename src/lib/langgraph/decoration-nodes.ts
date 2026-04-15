// 装修助手智能体节点实现
// 包含三大核心技能节点：知识问答、报价单检测、方案设计
// 所有任务都先进行知识库检索，然后基于检索结果回答

import type {
  DecorationAssistantState,
  SkillType,
  DesignRequirements,
  DesignProposal,
  QuotationAnalysis,
  KnowledgeResult,
} from './decoration-types';
import { callDoubaoLLM, DECORATION_SYSTEM_PROMPT, SKILL_IDENTIFICATION_PROMPT } from '../llm/doubao-client';
import { searchKnowledge, formatKnowledgeContext } from '../knowledge/volcano-knowledge';

/**
 * 1. 意图识别节点
 * 识别用户请求类型，确定使用哪个技能
 */
export async function skillIdentificationNode(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  console.log('[意图识别] 识别用户请求类型');
  console.log('[意图识别] 是否有文件:', !!state.files, '文件数量:', state.files?.length || 0);
  console.log('[意图识别] 用户消息:', state.userMessage || '(空)');

  const hasFiles = state.files && state.files.length > 0;
  const hasMessage = state.userMessage && state.userMessage.trim().length > 0;

  // 简单规则判断
  let skillType: SkillType = 'knowledge';

  // 如果有文件，判断文件类型和文件名
  if (hasFiles) {
    const fileNames = state.files!.map(f => f.name).join(',').toLowerCase();
    const fileTypes = state.files!.map(f => f.type || '').join(',').toLowerCase();

    console.log('[意图识别] 文件名:', fileNames);
    console.log('[意图识别] 文件类型:', fileTypes);

    // 规则1: 如果用户消息为空但有PDF文件，自动识别为报价单检测
    if (!hasMessage && fileTypes.includes('application/pdf')) {
      console.log('[意图识别] 检测到PDF文件且无消息，识别为报价单检测');
      skillType = 'quotation';
    }
    // 规则2: 文件名包含报价单关键词
    else if (
      fileNames.includes('报价') ||
      fileNames.includes('预算') ||
      fileNames.includes('quotation') ||
      fileNames.includes('estimate') ||
      fileNames.includes('清单') ||
      fileNames.includes('明细')
    ) {
      console.log('[意图识别] 文件名包含报价单关键词，识别为报价单检测');
      skillType = 'quotation';
    }
    // 规则3: 文件类型是PDF或Word/Excel，且用户消息为空或包含"分析"、"检测"等关键词
    else if (
      (fileTypes.includes('application/pdf') ||
       fileTypes.includes('application/msword') ||
       fileTypes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') ||
       fileTypes.includes('application/vnd.ms-excel') ||
       fileTypes.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) &&
      (!hasMessage || state.userMessage.includes('分析') || state.userMessage.includes('检测') || state.userMessage.includes('报价'))
    ) {
      console.log('[意图识别] 检测到文档文件，识别为报价单检测');
      skillType = 'quotation';
    }
  }

  // 如果没有文件，使用 LLM 进行意图识别
  if (!hasFiles && hasMessage) {
    try {
      const prompt = `${SKILL_IDENTIFICATION_PROMPT}

## 当前输入
用户消息: ${state.userMessage}
是否有文件: ${hasFiles}

请根据以上定义和输入，返回对应的技能类型（knowledge/quotation/design）:`;

      const response = await callDoubaoLLM([
        { role: 'user', content: prompt },
      ]);

      const identifiedSkill = response.content.trim().toLowerCase() as SkillType;
      console.log('[意图识别] LLM识别结果:', identifiedSkill);

      if (['knowledge', 'quotation', 'design'].includes(identifiedSkill)) {
        skillType = identifiedSkill;
      }
    } catch (error) {
      console.error('[意图识别] LLM识别失败，使用规则:', error);
    }
  }

  // 规则补充判断：如果用户消息中包含设计相关关键词
  if (skillType === 'knowledge' && hasMessage) {
    const designKeywords = [
      '设计',
      '方案',
      '规划',
      '布局',
      '全屋',
      '整套',
      '整体',
      '户型',
    ];
    if (designKeywords.some(k => state.userMessage.includes(k))) {
      console.log('[意图识别] 消息包含设计关键词，识别为方案设计');
      skillType = 'design';
    }
  }

  console.log('[意图识别] 识别结果:', skillType);

  return {
    ...state,
    skillType,
  };
}

/**
 * 2. 知识库检索节点（所有任务都先执行此节点）
 * 根据用户消息和技能类型，从知识库检索相关信息
 */
export async function knowledgeSearchNode(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  console.log('[知识库检索] 开始检索知识库，技能类型:', state.skillType);

  try {
    // 根据技能类型构建检索查询
    let searchQuery = state.userMessage;
    
    // 根据技能类型调整检索关键词
    if (state.skillType === 'quotation') {
      searchQuery = `报价单分析 装修预算 价格标准 ${state.userMessage}`;
    } else if (state.skillType === 'design') {
      searchQuery = `装修设计 ${state.userMessage} 布局方案 风格搭配`;
    }

    console.log('[知识库检索] 检索查询:', searchQuery);

    // 检索知识库（返回10条结果，提供更丰富的信息）
    const knowledgeResults: KnowledgeResult[] = await searchKnowledge(searchQuery, 10);
    
    console.log('[知识库检索] 检索完成，结果数量:', knowledgeResults.length);
    if (knowledgeResults.length > 0) {
      console.log('[知识库检索] 第一条结果标题:', knowledgeResults[0].title);
    }

    // 格式化知识库上下文
    const knowledgeContext = formatKnowledgeContext(knowledgeResults);
    console.log('[知识库检索] 上下文长度:', knowledgeContext.length);

    return {
      ...state,
      knowledgeQuery: searchQuery,
      knowledgeResults,
      knowledgeContext,
    };
  } catch (error) {
    console.error('[知识库检索] 检索失败:', error);
    // 即使检索失败，也返回空结果，不中断流程
    return {
      ...state,
      knowledgeQuery: state.userMessage,
      knowledgeResults: [],
      knowledgeContext: '',
    };
  }
}

/**
 * 3. 技能1：装修知识问答节点
 * 基于知识库检索结果回答用户问题
 */
export async function knowledgeQA(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  console.log('[技能1: 知识问答] 处理装修知识问题');
  console.log('[技能1: 知识问答] 用户消息:', state.userMessage);
  console.log('[技能1: 知识问答] 知识库结果数量:', state.knowledgeResults?.length || 0);

  try {
    // 使用知识库上下文构建提示词
    const knowledgeContext = state.knowledgeContext || '';
    
    const prompt = `${DECORATION_SYSTEM_PROMPT}

## 重要提示
你是一个专业的装修顾问，必须基于知识库提供的信息来回答用户问题。
请在回答中引用相关的知识库内容，标注信息来源。

## 用户问题
${state.userMessage}

## 知识库参考信息
${knowledgeContext || '暂无相关知识库信息，请根据你的专业知识回答。'}

## 回答要求
1. 用通俗易懂的语言回答，结合实际案例说明
2. 在必要时提供对比表格
3. 如果知识库中有相关标准或规范，请明确标注
4. 回答必须专业、准确、全面

请回答用户的问题：`;

    const response = await callDoubaoLLM(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: state.userMessage },
      ],
      { enableSearch: true, includeReasoning: true }
    );

    return {
      ...state,
      knowledgeAnswer: response.content,
      llmResponse: response.content,
      thinking: response.thinking || '',
    };
  } catch (error) {
    console.error('[技能1: 知识问答] 处理失败:', error);
    return {
      ...state,
      llmResponse: '抱歉，处理您的问题时出现了错误，请稍后重试。',
    };
  }
}

/**
 * 4. 技能2：报价单检测节点
 * 基于知识库检索结果分析装修报价单
 * 使用报价单检测工作流：PDF解析 → 知识库检索 → LLM分析 → HTML报告 → 发布网页
 */
export async function quotationAnalysisNode(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  console.log('[技能2: 报价单检测] 分析装修报价单');
  console.log('[技能2: 报价单检测] 知识库结果数量:', state.knowledgeResults?.length || 0);
  console.log('[技能2: 报价单检测] 接收到的文件信息:', state.files?.map(f => ({ name: f.name, url: f.url?.substring(0, 100) })));

  if (!state.files || state.files.length === 0) {
    return {
      ...state,
      llmResponse: '请上传装修报价单文件，我将为您进行分析。',
    };
  }

  const file = state.files[0];
  console.log('[技能2: 报价单检测] 使用第一个文件:', {
    name: file.name,
    url: file.url?.substring(0, 100),
  });

  try {
    // 导入报价单检测工作流
    const { quotationWorkflow } = await import('./quotation-workflow');

    // 构建报价单检测初始状态
    const quotationState = {
      fileUrl: state.files[0].url,
      fileName: state.files[0].name,
      timestamp: Date.now(),
    };

    console.log('[技能2: 报价单检测] 报价单工作流初始状态:', {
      fileUrl: quotationState.fileUrl.substring(0, 100),
      fileName: quotationState.fileName,
    });

    console.log('[技能2: 报价单检测] 开始执行报价单检测工作流');
    const startTime = Date.now();

    // 执行报价单检测工作流
    const result = await quotationWorkflow.invoke(quotationState);

    const endTime = Date.now();
    console.log('[技能2: 报价单检测] 工作流执行完成，耗时:', (endTime - startTime) + 'ms');

    // 构建分析文本
    const { structuredOutput, reportUrl } = result as {
      structuredOutput: any;
      reportUrl: string | undefined;
    };

    // 类型断言
    const output = structuredOutput as {
      overall_score: number | string;
      issues_count: number | string;
      high_severity_count: number | string;
      risk_level: string;
      file_source: string;
      proprietor: string;
      summary: string;
      issues: any[];
      additional_notes?: string;
    };

    // 转换数值字段为数字类型
    const overallScore = typeof output.overall_score === 'string'
      ? parseFloat(output.overall_score)
      : output.overall_score;
    const issuesCount = typeof output.issues_count === 'string'
      ? parseInt(output.issues_count, 10)
      : output.issues_count;
    const highSeverityCount = typeof output.high_severity_count === 'string'
      ? parseInt(output.high_severity_count, 10)
      : output.high_severity_count;
    const riskLevel = output.risk_level || 'unknown';

    // 构建 QuotationAnalysis 对象
    const quotationAnalysis: QuotationAnalysis = {
      totalAmount: 0, // 从工作流中提取（如果有）
      abnormalItems: output.issues.map(issue => ({
        item: issue.category || issue.location || '未知项目',
        price: 0, // 从工作流中提取（如果有）
        marketPrice: 0, // 从工作流中提取（如果有）
        reason: issue.description || issue.recommendation || '暂无说明',
      })),
      priceWarning: riskLevel === 'high' ? '报价存在高风险问题，建议仔细核对' : '报价整体合理',
      riskPoints: output.issues
        .filter(issue => issue.severity === 'high')
        .map(issue => issue.description || issue.category || '高风险项'),
      suggestions: output.issues
        .map(issue => issue.recommendation || '建议仔细核对')
        .filter(Boolean),
    };

    // 生成用户友好的分析文本
    const analysisText = `## 装修报价检测报告

### 📊 总览
- **报价单位**：${output.file_source || '未填写'}
- **工程信息**：${output.proprietor || '未填写'}
- **整体评分**：${overallScore.toFixed(1)}/100
- **风险等级**：${output.risk_level.toUpperCase()}
- **问题数量**：${issuesCount} 项（高风险 ${highSeverityCount} 项）

### 📝 总体评价
${output.summary || '暂无评价信息'}

${output.issues && output.issues.length > 0 ? `### ⚠️ 问题详情
${output.issues.map((issue, index) => `
**${index + 1}. ${issue.category} (${issue.severity.toUpperCase()}）**
- 位置：${issue.location || '未指定'}
- 描述：${issue.description}
- 建议：${issue.recommendation}
`).join('\n')}` : '### ✅ 未发现问题'}

### 📄 详细报告
[查看完整报告](${reportUrl})

---

**声明**：本报告由AI生成，建议结合实际情况核实细节；可视化报告链接有效期7天，请及时查看。`;

    return {
      ...state,
      quotationFile: state.files[0],
      quotationAnalysis,
      quotationReportUrl: reportUrl,
      llmResponse: analysisText,
      thinking: '', // 工作流内部已包含思考过程
    };
  } catch (error) {
    console.error('[技能2: 报价单检测] 处理失败:', error);
    return {
      ...state,
      llmResponse: '抱歉，分析报价单时出现了错误，请稍后重试。',
    };
  }
}

/**
 * 5. 技能3：方案设计节点
 * 基于知识库检索结果生成装修方案
 */
export async function designProposalNode(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  console.log('[技能3: 方案设计] 生成装修方案');
  console.log('[技能3: 方案设计] 知识库结果数量:', state.knowledgeResults?.length || 0);

  try {
    // 第一步：检查是否需要收集更多信息
    const missingInfo: string[] = [];

    // 简单的信息提取逻辑（实际应使用更复杂的NLP）
    const message = state.userMessage;

    const hasArea = /\d+.*平方米|㎡|平米/.test(message);
    const hasStyle = /现代|简约|日式|北欧|轻奢|中式|欧式/.test(message);

    if (!hasArea) {
      missingInfo.push('户型面积');
    }
    if (!hasStyle) {
      missingInfo.push('风格偏好');
    }
    missingInfo.push('预算范围');
    missingInfo.push('常住人口');
    missingInfo.push('特殊需求');

    if (missingInfo.length > 0) {
      // 需要追问信息
      const missingInfoText = missingInfo.join('、');
      return {
        ...state,
        llmResponse: `为了给您提供更精准的装修方案，需要您补充以下信息：${missingInfoText}\n\n请提供这些信息，我将为您设计3套适配方案（现代简约、日式侘寂、轻奢）`,
      };
    }

    // 提取信息（简化版）
    const areaMatch = message.match(/(\d+).*[平方米|㎡|平米]/);
    const area = areaMatch ? parseInt(areaMatch[1]) : 90;

    const styles = ['现代简约', '日式侘寂', '轻奢'];
    let detectedStyle = '现代简约';
    if (message.includes('日式')) detectedStyle = '日式侘寂';
    else if (message.includes('轻奢')) detectedStyle = '轻奢';

    // 使用知识库上下文增强方案设计
    const knowledgeContext = state.knowledgeContext || '';

    // 构建提示词，结合知识库信息
    const prompt = `${DECORATION_SYSTEM_PROMPT}

## 重要提示
你是一个专业的室内设计师，需要基于知识库提供的设计规范和标准来生成装修方案。

## 知识库参考信息
${knowledgeContext || '暂无相关知识库信息，请根据你的专业知识设计。'}

## 设计要求
1. 结合用户需求提供3套差异化方案（现代简约、日式侘寂、轻奢）
2. 每套方案包括布局、材料、预算、亮点
3. 引用相关的设计规范和标准
4. 提供详细的方案对比表

## 用户需求
${state.userMessage}

请生成详细的装修方案设计：`;

    const response = await callDoubaoLLM(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: state.userMessage },
      ],
      { enableSearch: true, includeReasoning: true }
    );

    // 生成3套方案
    const proposals: DesignProposal[] = [
      {
        style: '现代简约',
        description: `${area}㎡户型 - 客餐厅一体化+开放式厨房，主卧室L型衣柜，次卧室多功能榻榻米，动线总长优化12%`,
        estimatedCost: area * 1230,
        pros: ['极简线条设计，空间感强', '开放式厨房增加通透性', '多功能储物设计'],
        cons: ['收纳空间相对较少', '需要精心搭配软装'],
      },
      {
        style: '日式侘寂',
        description: `${area}㎡户型 - 玄关下沉式设计+LDK客餐厨一体化，和室茶室，原木色系贯穿全屋，自然光最大化利用`,
        estimatedCost: area * 1460,
        pros: ['天然材质，回归自然', '光影设计营造静谧氛围', '多功能和室空间'],
        cons: ['维护成本较高', '对施工工艺要求高'],
      },
      {
        style: '轻奢',
        description: `${area}㎡户型 - 独立玄关柜+餐厅岛台+主卧衣帽间，金属线条点缀，精致收口细节，品质感提升`,
        estimatedCost: area * 2000,
        pros: ['精致金属线条点缀', '高级质感材料搭配', '定制化收纳系统'],
        cons: ['预算要求较高', '需要专业设计师'],
      },
    ];

    // 构建方案对比表
    const comparisonTable = `
## 装修方案对比

| 维度 | 方案A（现代简约） | 方案B（日式侘寂） | 方案C（轻奢） |
|------|------------------|------------------|---------------|
| **风格** | 极简线条，清爽明亮 | 自然质朴，静谧禅意 | 精致奢华，高端大气 |
| **布局** | 客餐厅一体化+开放厨房 | LDK一体化+和室茶室 | 独立玄关+餐厅岛台+衣帽间 |
| **预算** | ¥${(area * 1230).toLocaleString()} | ¥${(area * 1460).toLocaleString()} | ¥${(area * 2000).toLocaleString()} |
| **工期** | 90天 | 105天 | 120天 |
| **适合人群** | 年轻家庭，追求效率 | 注重品质，喜欢自然 | 追求品质，预算充足 |

`;

    // 构建完整响应
    let fullResponse = `## 您的专属装修方案设计

根据您的需求，我为您设计了3套差异化方案，每套方案都有独特的风格和特点：

---

### 方案A：${proposals[0].style}

${proposals[0].description}

**预算估算**：${proposals[0].estimatedCost}元

**方案优点**：
${proposals[0].pros.map((h, i) => `- ${h}`).join('\n')}

**注意事项**：
${proposals[0].cons.map((h, i) => `- ${h}`).join('\n')}

---

### 方案B：${proposals[1].style}

${proposals[1].description}

**预算估算**：${proposals[1].estimatedCost}元

**方案优点**：
${proposals[1].pros.map((h, i) => `- ${h}`).join('\n')}

**注意事项**：
${proposals[1].cons.map((h, i) => `- ${h}`).join('\n')}

---

### 方案C：${proposals[2].style}

${proposals[2].description}

**预算估算**：${proposals[2].estimatedCost}元

**方案优点**：
${proposals[2].pros.map((h, i) => `- ${h}`).join('\n')}

**注意事项**：
${proposals[2].cons.map((h, i) => `- ${h}`).join('\n')}

---

${comparisonTable}

**声明**：本方案非最终施工依据，建议提供CAD图纸至专业设计院复核后施工。`;

    return {
      ...state,
      designRequirements: {
        area,
        style: detectedStyle,
        budget: area * 1500,
      },
      designProposals: proposals,
      designComparison: comparisonTable,
      llmResponse: fullResponse,
      thinking: response.thinking || '',
    };
  } catch (error) {
    console.error('[技能3: 方案设计] 处理失败:', error);
    return {
      ...state,
      llmResponse: '抱歉，生成装修方案时出现了错误，请稍后重试。',
    };
  }
}
