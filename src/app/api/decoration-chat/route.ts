// 装修助手聊天 API
// 基于豆包LLM + 火山引擎知识库 + 扣子工作流 + 真正的流式输出

import { NextRequest, NextResponse } from 'next/server';
import {
  callDoubaoLLMStream,
  callDoubaoImageAnalysisStream,
  Message,
  DECORATION_SYSTEM_PROMPT,
  SKILL_IDENTIFICATION_PROMPT,
} from '@/lib/llm/doubao-client';
import {
  FileInfo,
  KnowledgeResult,
  SkillType,
} from '@/lib/langgraph/decoration-types';
import { searchKnowledge, formatKnowledgeContext } from '@/lib/knowledge/volcano-knowledge';
import { cozeWorkflowClient } from '@/lib/coze/workflow-client';

/**
 * 意图识别
 */
async function identifySkill(
  userMessage: string,
  files?: FileInfo[]
): Promise<SkillType> {
  console.log('[意图识别] 开始识别用户请求类型');
  console.log('[意图识别] 是否有文件:', !!files, '文件数量:', files?.length || 0);

  const hasFiles = files && files.length > 0;
  const hasMessage = userMessage && userMessage.trim().length > 0;

  // 简单规则判断
  let skillType: SkillType = 'knowledge';

  // 如果有文件，判断文件类型和文件名
  if (hasFiles) {
    const fileNames = files!.map(f => f.name).join(',').toLowerCase();
    const fileTypes = files!.map(f => f.type || '').join(',').toLowerCase();

    console.log('[意图识别] 文件名:', fileNames);
    console.log('[意图识别] 文件类型:', fileTypes);

    // 规则0: 优先检测图片文件（装修图片风格分析）
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    const hasImageFile = files!.some(f => imageTypes.includes(f.type || ''));
    if (hasImageFile) {
      console.log('[意图识别] 检测到图片文件，识别为图片风格分析');
      skillType = 'image_analysis';
    }
    // 规则1: 如果用户消息为空但有PDF文件，自动识别为报价单检测
    else if (!hasMessage && fileTypes.includes('application/pdf')) {
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
      (!hasMessage || userMessage.includes('分析') || userMessage.includes('检测') || userMessage.includes('报价'))
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
用户消息: ${userMessage}
是否有文件: ${hasFiles}

请根据以上定义和输入，返回对应的技能类型（knowledge/quotation/design）:`;

      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DOUBAO_API_KEY || ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DOUBAO_MODEL || 'doubao-seed-2-0-pro-260215',
          input: prompt,
        }),
      });

      const data = await response.json();
      const content = data.output?.[0]?.content?.[0]?.text || '';
      const identifiedSkill = content.trim().toLowerCase() as SkillType;
      
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
    if (designKeywords.some(k => userMessage.includes(k))) {
      console.log('[意图识别] 消息包含设计关键词，识别为方案设计');
      skillType = 'design';
    }
  }

  console.log('[意图识别] 识别结果:', skillType);
  return skillType;
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(skillType: SkillType, knowledgeContext: string): string {
  return `${DECORATION_SYSTEM_PROMPT}

## 当前任务
技能类型: ${skillType}
知识库参考信息:
${knowledgeContext || '暂无相关知识库信息，请根据你的专业知识回答。'}

## 回答要求
1. 用通俗易懂的语言回答，结合实际案例说明
2. 在必要时提供对比表格
3. 如果知识库中有相关标准或规范，请明确标注
4. 回答必须专业、准确、全面
5. **在回答中引用知识库来源时，使用[1]、[2]等数字标记**
`;
}

/**
 * 日志工具
 */
const logger = {
  info: (message: string, ...args: any[]) => {
    console.log(`[装修助手API] ${message}`, ...args);
  },
  error: (message: string, error: any) => {
    console.error(`[装修助手API] ${message}`, error);
  },
  warn: (message: string, ...args: any[]) => {
    console.warn('[装修助手API] ${message}', ...args);
  },
};

/**
 * POST 处理聊天请求（真正流式输出）
 */
export async function POST(request: NextRequest) {
  logger.info('收到请求');

  // 创建 SSE 流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let isControllerClosed = false;
      
      const sendEvent = (data: any) => {
        if (!isControllerClosed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        }
      };

      try {
        const body = await request.json();
        const { message, files, userId, conversationId } = body;

        logger.info('收到请求，参数:', {
          messageLength: message?.length || 0,
          filesCount: files?.length || 0,
          userId,
          conversationId,
        });

        // 验证输入
        if (!message && (!files || files.length === 0)) {
          sendEvent({
            type: 'error',
            error: '消息或文件不能为空',
          });
          sendEvent('[DONE]');
          isControllerClosed = true;
          controller.close();
          return;
        }

        // 使用前端传递的用户ID，如果没有则生成新的
        const finalUserId = userId || 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
        const finalConversationId = conversationId || 'conv_' + Date.now();

        logger.info('请求参数:', {
          finalUserId,
          finalConversationId,
          messageLength: message?.length || 0,
          filesCount: files?.length || 0,
        });

        // 1. 意图识别
        logger.info('步骤1: 意图识别');
        const skillType = await identifySkill(message, files);
        
        sendEvent({
          type: 'skill_identified',
          skill_type: skillType,
        });

        // 2. 知识库检索
        logger.info('步骤2: 知识库检索，技能类型:', skillType);
        
        let searchQuery = message;
        if (skillType === 'quotation') {
          searchQuery = `报价单分析 装修预算 价格标准 ${message}`;
        } else if (skillType === 'design') {
          searchQuery = `装修设计 ${message} 布局方案 风格搭配`;
        }

        const knowledgeResults: KnowledgeResult[] = await searchKnowledge(searchQuery, 10);
        logger.info('知识库检索完成，结果数量:', knowledgeResults.length);

        const knowledgeContext = formatKnowledgeContext(knowledgeResults);
        logger.info('知识库上下文长度:', knowledgeContext.length);

        // 3. 如果是报价单检测，调用扣子工作流
        if (skillType === 'quotation' && files && files.length > 0) {
          const fileUrl = files[0].url;
          const fileName = files[0].name;

          logger.info('步骤3: 调用扣子工作流进行报价单检测');
          logger.info('报价单文件:', fileName, 'URL:', fileUrl.substring(0, 100));

          // 发送开始提示
          sendEvent({
            type: 'answer',
            content: '📄 正在分析报价单，这可能需要几分钟时间，请耐心等待...\n\n',
            is_complete: false,
          });

          try {
            // 调用扣子工作流（添加超时控制）
            logger.info('开始调用扣子工作流API');
            
            // 设置超时时间为14分钟（比Next.js的maxDuration少1分钟）
            const timeoutMs = 14 * 60 * 1000;
            const abortController = new AbortController();
            const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
            
            const resultPromise = cozeWorkflowClient.detectQuotation(fileUrl);
            
            // 添加一个定时器，每30秒发送一次状态更新
            const updateInterval = setInterval(() => {
              if (!isControllerClosed) {
                sendEvent({
                  type: 'answer',
                  content: '',
                  is_complete: false,
                });
              }
            }, 30000);
            
            let result: string;
            
            try {
              result = await Promise.race<string>([
                resultPromise,
                new Promise<string>((_, reject) =>
                  setTimeout(() => reject(new Error('扣子工作流执行超时')), timeoutMs)
                )
              ]);
              
              clearTimeout(timeoutId);
              clearInterval(updateInterval);
              
              logger.info('扣子工作流调用成功，结果长度:', result.length);
            } catch (timeoutError) {
              clearTimeout(timeoutId);
              clearInterval(updateInterval);
              
              logger.error('扣子工作流调用失败（超时）:', timeoutError);
              
              sendEvent({
                type: 'answer',
                content: '⏱️ 报价单分析超时。扣子工作流正在处理中，请稍后重试，或向我咨询装修知识。',
                is_complete: true,
                skill_type: skillType,
              });
              
              sendEvent('[DONE]');
              isControllerClosed = true;
              controller.close();
              return;
            }
            
            // 解析工作流返回的结果
            let structuredOutput: any;
            let reportUrl = '';

            logger.info('开始解析工作流响应，结果长度:', result.length);
            logger.info('工作流响应前200字符:', result.substring(0, 200));

            try {
              const workflowResponse = JSON.parse(result);
              logger.info('JSON解析成功，类型:', typeof workflowResponse);
              logger.info('workflowResponse keys:', Object.keys(workflowResponse));
              
              structuredOutput = workflowResponse.output || workflowResponse.data || workflowResponse;
              reportUrl = workflowResponse.url || '';

              logger.info('工作流响应解析成功');
              logger.info('structuredOutput keys:', Object.keys(structuredOutput || {}));
              logger.info('问题数量:', structuredOutput.issues_count || 0);
              logger.info('整体评分:', structuredOutput.overall_score || 0);
            } catch (parseError) {
              logger.error('解析工作流响应失败:', parseError);
              logger.error('完整响应:', result);
              throw new Error('无法解析工作流响应');
            }

            // 生成分析文本
            const overallScore = typeof structuredOutput.overall_score === 'string'
              ? parseFloat(structuredOutput.overall_score)
              : (structuredOutput.overall_score || 0);
            const issuesCount = typeof structuredOutput.issues_count === 'string'
              ? parseInt(structuredOutput.issues_count, 10)
              : (structuredOutput.issues_count || 0);
            const highSeverityCount = typeof structuredOutput.high_severity_count === 'string'
              ? parseInt(structuredOutput.high_severity_count, 10)
              : (structuredOutput.high_severity_count || 0);
            const riskLevel = structuredOutput.risk_level || 'unknown';

            // 根据风险等级选择emoji
            const riskEmoji = riskLevel === 'high' ? '🔴' : riskLevel === 'medium' ? '🟡' : '🟢';

            let analysisText = `## 装修报价检测报告\n\n`;
            
            analysisText += `### 📊 总览\n`;
            analysisText += `- **报价单位**：${structuredOutput.file_source || '未填写'}\n`;
            analysisText += `- **工程信息**：${structuredOutput.proprietor || '未填写'}\n`;
            analysisText += `- **整体评分**：${overallScore.toFixed(1)}/100\n`;
            analysisText += `- **风险等级**：${riskEmoji} ${riskLevel.toUpperCase()}\n`;
            analysisText += `- **问题数量**：${issuesCount} 项（高风险 ${highSeverityCount} 项）\n\n`;

            analysisText += `### 📝 总体评价\n${structuredOutput.summary || '暂无评价信息'}\n\n`;

            // 问题详情
            if (structuredOutput.issues && Array.isArray(structuredOutput.issues) && structuredOutput.issues.length > 0) {
              analysisText += `### ⚠️ 问题详情\n\n`;
              structuredOutput.issues.forEach((issue: any, index: number) => {
                const severityEmoji = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🟢';
                analysisText += `**${index + 1}. ${issue.category || '未分类'} (${severityEmoji} ${issue.severity?.toUpperCase() || 'UNKNOWN'}）**\n`;
                analysisText += `- 位置：${issue.location || '未指定'}\n`;
                analysisText += `- 描述：${issue.description || '无描述'}\n`;
                if (issue.recommendation) {
                  analysisText += `- 建议：${issue.recommendation}\n`;
                }
                analysisText += '\n';
              });
            } else {
              analysisText += `### ✅ 未发现问题\n\n`;
            }

            // 附加信息
            if (structuredOutput.additional_notes) {
              analysisText += `### 📌 附加说明\n${structuredOutput.additional_notes}\n\n`;
            }

            // 报告链接
            if (reportUrl) {
              analysisText += `### 📄 详细报告\n\n[点击查看完整报告](${reportUrl})\n\n`;
            }

            analysisText += `---\n\n**声明**：本报告由AI生成，建议结合实际情况核实细节；${reportUrl ? '可视化报告链接有效期7天，' : ''}请及时查看。`;

            // 发送分析结果
            logger.info('发送分析结果，文本长度:', analysisText.length);
            sendEvent({
              type: 'answer',
              content: analysisText,
              is_complete: true,
              skill_type: skillType,
            });

            // 发送报告链接
            if (reportUrl) {
              logger.info('发送报告链接:', reportUrl);
              sendEvent({
                type: 'report_link',
                url: reportUrl,
              });
            }

            // 发送结束标记
            logger.info('报价单检测完成，发送 [DONE]');
            sendEvent('[DONE]');
            isControllerClosed = true;
            controller.close();
            return;

          } catch (workflowError) {
            logger.error('扣子工作流调用失败:', workflowError);
            
            const errorMsg = workflowError instanceof Error ? workflowError.message : '未知错误';
            
            sendEvent({
              type: 'answer',
              content: `❌ 报价单分析失败：${errorMsg}\n\n请稍后重试，或向我咨询装修知识。`,
              is_complete: true,
              skill_type: skillType,
            });
            
            sendEvent('[DONE]');
            isControllerClosed = true;
            controller.close();
            return;
          }
        }

        // 3.5. 如果是图片风格分析，调用豆包图像识别
        if (skillType === 'image_analysis' && files && files.length > 0) {
          const fileUrl = files[0].url;
          const fileName = files[0].name;

          logger.info('步骤3.5: 调用豆包图像识别进行风格分析');
          logger.info('图片文件:', fileName, 'URL:', fileUrl.substring(0, 100));

          // 发送开始提示
          sendEvent({
            type: 'answer',
            content: '🖼️ 正在分析图片风格，请稍候...\n\n',
            is_complete: false,
          });

          try {
            // 构建分析提示词
            const analysisPrompt = message || '请详细分析这张装修图片的风格、设计优缺点、预算估算和优化建议。';
            
            logger.info('开始调用豆包图像分析API');
            
            // 调用豆包图像分析流式API
            let fullContent = '';
            
            for await (const chunk of callDoubaoImageAnalysisStream(fileUrl, analysisPrompt)) {
              if (chunk.type === 'content' && chunk.content) {
                fullContent += chunk.content;
                sendEvent({
                  type: 'answer',
                  content: fullContent,
                  is_complete: false,
                  skill_type: skillType,
                });
              } else if (chunk.type === 'done') {
                sendEvent({
                  type: 'answer',
                  content: fullContent,
                  is_complete: true,
                  skill_type: skillType,
                });
                break;
              }
            }

            logger.info('图片分析完成，内容长度:', fullContent.length);
            
            // 发送结束标记
            logger.info('图片风格分析完成，发送 [DONE]');
            sendEvent('[DONE]');
            isControllerClosed = true;
            controller.close();
            return;

          } catch (imageError) {
            logger.error('图片分析失败:', imageError);
            
            const errorMsg = imageError instanceof Error ? imageError.message : '未知错误';
            
            sendEvent({
              type: 'answer',
              content: `❌ 图片分析失败：${errorMsg}\n\n请稍后重试，或向我咨询装修知识。`,
              is_complete: true,
              skill_type: skillType,
            });
            
            sendEvent('[DONE]');
            isControllerClosed = true;
            controller.close();
            return;
          }
        }

        // 4. 构建LLM调用消息
        const systemPrompt = buildSystemPrompt(skillType, knowledgeContext);
        const llmMessages: Message[] = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ];

        logger.info('步骤3: 调用LLM流式输出');

        // 5. 调用豆包LLM流式输出
        let fullContent = '';
        let fullThinking = '';

        for await (const chunk of callDoubaoLLMStream(llmMessages, { includeReasoning: true })) {
          if (chunk.type === 'reasoning' && chunk.content) {
            fullThinking += chunk.content;
            sendEvent({
              type: 'answer',
              reasoning_content: fullThinking,
              is_complete: false,
            });
          } else if (chunk.type === 'content' && chunk.content) {
            fullContent += chunk.content;
            sendEvent({
              type: 'answer',
              content: fullContent,
              is_complete: false,
              skill_type: skillType,
            });
          } else if (chunk.type === 'done') {
            sendEvent({
              type: 'answer',
              content: fullContent,
              is_complete: true,
              skill_type: skillType,
            });
            break;
          }
        }

        // 6. 发送知识库来源
        if (knowledgeResults.length > 0) {
          logger.info('发送知识库来源，数量:', knowledgeResults.length);
          
          const sourcesMessage = {
            type: 'sources',
            sources: knowledgeResults.map((r, idx) => ({
              index: String(idx + 1),
              title: r.title || `来源 ${idx + 1}`,
              content: r.content?.substring(0, 200) || '',
              link: r.url || r.source || '',
              datasetName: r.category || '知识库',
              score: r.score || r.confidence || 0,
            })),
          };
          sendEvent(sourcesMessage);
        }

        // 7. 发送结束标记
        logger.info('发送结束标记 [DONE]');
        sendEvent('[DONE]');

        logger.info('流式输出完成');
      } catch (error) {
        logger.error('执行错误:', error);
        sendEvent({
          type: 'error',
          error: error instanceof Error ? error.message : '未知错误',
        });
        sendEvent('[DONE]');
      } finally {
        if (!isControllerClosed) {
          controller.close();
          isControllerClosed = true;
        }
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * GET 检查 API 状态
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: '装修助手API运行正常（流式输出版本）',
    version: '3.0.0',
    features: [
      '装修知识问答',
      '报价单检测（开发中）',
      '方案设计',
    ],
    integrations: {
      llm: '豆包 (Doubao) - 流式输出',
      knowledgeBase: '火山引擎知识库',
      streaming: true,
    },
  });
}
