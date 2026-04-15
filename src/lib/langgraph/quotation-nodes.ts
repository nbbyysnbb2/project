// 装修报价单检测节点实现
// 使用扣子工作流：PDF解析 → 知识库检索 → LLM分析 → HTML报告 → 发布网页

import type {
  QuotationAnalysisState,
  StructuredOutput,
  Issue,
} from './quotation-types';
import { callDoubaoLLM, DECORATION_SYSTEM_PROMPT } from '../llm/doubao-client';
import { searchKnowledge, formatKnowledgeContext } from '../knowledge/volcano-knowledge';
import { generateQuotationReport, publishHtmlReport } from '../utils/report-generator';
import { parsePdfFromUrl } from './pdf-parser';
import { cozeWorkflowClient } from '../coze/workflow-client';

/**
 * 1. PDF解析节点
 * 使用pdf-parse库解析PDF文件
 */
export async function pdfParsingNode(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 步骤1: 开始解析PDF文件');
  console.log('[报价单检测] 文件URL:', state.fileUrl);
  console.log('[报价单检测] 文件名:', state.fileName);

  if (!state.fileUrl) {
    throw new Error('文件URL为空');
  }

  try {
    // 检查文件类型
    const response = await fetch(state.fileUrl);
    const contentType = response.headers.get('content-type');
    console.log('[报价单检测] 文件类型:', contentType);

    let pdfContent: string;

    if (contentType?.includes('application/pdf')) {
      // 使用PDF解析库解析PDF
      console.log('[报价单检测] 使用PDF解析库解析PDF文件');
      pdfContent = await parsePdfFromUrl(state.fileUrl);
    } else {
      // 如果是文本文件，直接读取
      console.log('[报价单检测] 文本文件，直接读取内容');
      const text = await response.text();
      pdfContent = text;
    }

    console.log('[报价单检测] 文件解析完成，内容长度:', pdfContent.length);
    console.log('[报价单检测] 文件内容预览:', pdfContent.substring(0, 200));

    return {
      ...state,
      pdfContent,
    };
  } catch (error) {
    console.error('[报价单检测] PDF解析失败:', error);
    // 返回占位符，避免中断流程
    return {
      ...state,
      pdfContent: `[文件解析失败: ${error instanceof Error ? error.message : '未知错误'}]`,
    };
  }
}

/**
 * 2. 知识库检索节点
 * 根据PDF内容从知识库检索相关信息
 */
export async function knowledgeSearchNodeForQuotation(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 步骤2: 开始知识库检索');
  console.log('[报价单检测] PDF内容长度:', state.pdfContent.length);

  try {
    // 从PDF内容提取关键信息作为查询
    // 取PDF内容的前500字符作为查询
    const query = state.pdfContent.substring(0, 500);
    const searchQuery = `装修报价单 价格标准 材料规格 工艺说明 ${query}`;

    console.log('[报价单检测] 检索查询:', searchQuery.substring(0, 100) + '...');

    // 检索知识库
    const knowledgeResults = await searchKnowledge(searchQuery, 5);

    console.log('[报价单检测] 知识库检索完成，结果数量:', knowledgeResults.length);

    // 格式化知识库上下文
    const knowledgeContext = formatKnowledgeContext(knowledgeResults);
    console.log('[报价单检测] 上下文长度:', knowledgeContext.length);

    return {
      ...state,
      knowledgeQuery: searchQuery,
      knowledgeResults,
      knowledgeContext,
    };
  } catch (error) {
    console.error('[报价单检测] 知识库检索失败:', error);
    // 即使检索失败，也继续执行
    return {
      ...state,
      knowledgeQuery: state.pdfContent.substring(0, 500),
      knowledgeResults: [],
      knowledgeContext: '',
    };
  }
}

/**
 * 3. LLM分析节点
 * 使用千问LLM分析报价单并生成结构化输出
 */
export async function llmAnalysisNode(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 步骤3: 开始LLM分析');
  console.log('[报价单检测] PDF内容长度:', state.pdfContent.length);
  console.log('[报价单检测] 知识库结果数量:', state.knowledgeResults?.length || 0);

  try {
    // 构建分析提示词（复用扣子的提示词）
    const prompt = `${DECORATION_SYSTEM_PROMPT}

## 任务说明
你是一位专业的装修报价单审核专家。你的任务是参考室内装修知识{{knowledge}}仔细分析装修报价单{{file}}，识别其中可能存在的问题。

## 分析维度
1. 价格合理性：是否存在明显高于或低于市场价的项目
2. 项目完整性：是否遗漏了必要的装修项目
3. 材料规格：材料品牌、型号、规格是否明确
4. 工艺说明：施工工艺是否详细说明
5. 计量单位：面积、数量计算是否准确
6. 隐藏费用：是否存在模糊不清的收费项目
7. 合同条款：付款方式、质保期等是否合理

## 输出要求
对每个问题标注：
- 问题类别（category）
- 严重程度（severity: high/medium/low）
- 具体描述（description）
- 位置（location）
- 改进建议（recommendation）

最后给出：
- 整体评分（overall_score: 0-100分）
- 总体评价（summary）
- 风险等级（risk_level: high/medium/low）
- 业主信息（proprietor）- 施工地址、施工时间等
- 报价单位信息（file_source）- 报价单位、报价日期、联系人、电话等

## 报价单内容
\`\`\`
${state.pdfContent}
\`\`\`

## 知识库参考信息
\`\`\`
${state.knowledgeContext || '暂无相关知识库信息'}
\`\`\`

请以JSON格式输出分析结果（不要包含其他文字）:
\`\`\`json
{
  "file_source": "...",
  "proprietor": "...",
  "issues": [
    {
      "category": "...",
      "severity": "high/medium/low",
      "description": "...",
      "location": "...",
      "recommendation": "..."
    }
  ],
  "issues_count": 数字,
  "high_severity_count": 数字,
  "overall_score": 数字,
  "risk_level": "high/medium/low",
  "summary": "..."
}
\`\`\``;

    // 调用LLM
    const response = await callDoubaoLLM(
      [
        { role: 'system', content: prompt },
        { role: 'user', content: '请分析报价单并以JSON格式输出结果' },
      ],
      {
        temperature: 0.5,
        includeReasoning: true,
        maxTokens: 8192,
      }
    );

    console.log('[报价单检测] LLM响应成功，内容长度:', response.content.length);

    // 解析JSON响应
    let structuredOutput: StructuredOutput;
    try {
      // 尝试从响应中提取JSON
      const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
      const jsonString = jsonMatch ? jsonMatch[1] : response.content;

      // 清理JSON字符串（移除注释等）
      const cleanJson = jsonString.replace(/\/\*[\s\S]*?\*\//g, '').trim();

      structuredOutput = JSON.parse(cleanJson);
      console.log('[报价单检测] JSON解析成功');
      console.log('[报价单检测] 问题数量:', structuredOutput.issues_count);
      console.log('[报价单检测] 整体评分:', structuredOutput.overall_score);
      console.log('[报价单检测] 风险等级:', structuredOutput.risk_level);
    } catch (error) {
      console.error('[报价单检测] JSON解析失败:', error);
      console.error('[报价单检测] LLM响应:', response.content.substring(0, 500));

      // 返回默认结构
      structuredOutput = {
        file_source: '解析失败',
        proprietor: '解析失败',
        issues: [],
        issues_count: 0,
        high_severity_count: 0,
        overall_score: 0,
        risk_level: 'low',
        summary: '报价单解析失败，请检查文件格式后重试。',
      };
    }

    return {
      ...state,
      structuredOutput,
    };
  } catch (error) {
    console.error('[报价单检测] LLM分析失败:', error);
    throw new Error('报价单分析失败，请稍后重试');
  }
}

/**
 * 4. HTML报告生成节点
 * 基于LLM分析结果生成HTML报告
 */
export async function reportGenerationNode(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 步骤4: 开始生成HTML报告');
  console.log('[报价单检测] 问题数量:', state.structuredOutput.issues_count);

  try {
    // 生成HTML报告
    const htmlReport = generateQuotationReport(state.structuredOutput);

    console.log('[报价单检测] HTML报告生成完成，长度:', htmlReport.length);

    return {
      ...state,
      htmlReport,
    };
  } catch (error) {
    console.error('[报价单检测] HTML报告生成失败:', error);
    throw new Error('HTML报告生成失败，请稍后重试');
  }
}

/**
 * 5. HTML发布节点
 * 使用阿里云OSS发布HTML报告
 */
export async function htmlPublishNode(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 步骤5: 开始发布HTML报告');

  try {
    // 生成报告文件名
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const fileName = `quotation-report-${timestamp}-${randomStr}.html`;

    console.log('[报价单检测] 调用HTML发布API');

    // 调用HTML发布API
    const { publishHtmlReport } = await import('../utils/report-generator');
    const reportUrl = await publishHtmlReport(state.htmlReport, fileName);

    console.log('[报价单检测] HTML报告发布成功:', reportUrl);

    return {
      ...state,
      reportUrl,
    };
  } catch (error) {
    console.error('[报价单检测] HTML发布失败:', error);
    // 返回占位符URL
    return {
      ...state,
      reportUrl: `https://example.com/report/${Date.now()}.html`,
    };
  }
}


/**
 * 使用扣子工作流进行报价单检测（替代整个流程）
 */
export async function cozeWorkflowNode(
  state: QuotationAnalysisState
): Promise<QuotationAnalysisState> {
  console.log('[报价单检测] 使用扣子工作流进行报价单检测');
  console.log('[报价单检测] 文件URL:', state.fileUrl);
  console.log('[报价单检测] 文件名:', state.fileName);

  if (!state.fileUrl) {
    throw new Error('文件URL为空');
  }

  try {
    // 调用扣子工作流
    const result = await cozeWorkflowClient.detectQuotation(state.fileUrl);

    console.log('[报价单检测] 扣子工作流响应成功');
    console.log('[报价单检测] 响应长度:', result.length);
    console.log('[报价单检测] 响应预览:', result.substring(0, 500));

    // 尝试解析工作流返回的结果
    // 假设工作流返回的是JSON格式的分析结果
    let structuredOutput: StructuredOutput;
    let reportUrl = '';

    try {
      // 解析工作流返回的JSON（格式：{"output": {...}, "url": "..."}）
      const workflowResponse = JSON.parse(result);

      // 提取output作为结构化输出
      if (workflowResponse.output) {
        structuredOutput = workflowResponse.output;
        console.log('[报价单检测] JSON解析成功');
        console.log('[报价单检测] 问题数量:', structuredOutput.issues_count);
        console.log('[报价单检测] 整体评分:', structuredOutput.overall_score);
      } else {
        throw new Error('工作流响应中没有output字段');
      }

      // 提取HTML报告URL
      if (workflowResponse.url) {
        reportUrl = workflowResponse.url;
        console.log('[报价单检测] HTML报告URL:', reportUrl);
      }

    } catch (error) {
      console.error('[报价单检测] JSON解析失败:', error);
      console.error('[报价单检测] 工作流响应:', result.substring(0, 500));

      // 如果无法解析为JSON，返回默认结构
      structuredOutput = {
        file_source: state.fileName || '未知',
        proprietor: '未提供',
        issues: [],
        issues_count: 0,
        high_severity_count: 0,
        overall_score: 75,
        risk_level: 'low',
        summary: result.substring(0, 1000),
      };
    }

    return {
      ...state,
      structuredOutput,
      pdfContent: result, // 保存工作流的完整响应
      reportUrl, // 保存HTML报告URL
    };
  } catch (error) {
    console.error('[报价单检测] 扣子工作流运行失败:', error);
    throw new Error(`扣子工作流运行失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}

/**
 * 使用扣子工作流进行报价单检测（流式版本）
 */
export async function* cozeWorkflowNodeStream(
  state: QuotationAnalysisState
): AsyncGenerator<QuotationAnalysisState> {
  console.log('[报价单检测] 使用扣子工作流流式进行报价单检测');
  console.log('[报价单检测] 文件URL:', state.fileUrl);

  if (!state.fileUrl) {
    throw new Error('文件URL为空');
  }

  try {
    const startTime = Date.now();

    // 流式调用扣子工作流
    for await (const event of cozeWorkflowClient.detectQuotationStream(state.fileUrl)) {
      console.log('[报价单检测] 收到事件:', event.event);

      if (event.event === 'message' && event.message) {
        // 发送中间状态
        yield {
          ...state,
          intermediateResult: event.message,
          processingTime: Date.now() - startTime,
        };
      } else if (event.event === 'error') {
        console.error('[报价单检测] 工作流错误:', event.error);
        throw new Error(event.error);
      }
    }

    // 最终结果
    yield {
      ...state,
      processingTime: Date.now() - startTime,
      isCompleted: true,
    };
  } catch (error) {
    console.error('[报价单检测] 扣子工作流流式运行失败:', error);
    throw new Error(`扣子工作流流式运行失败: ${error instanceof Error ? error.message : '未知错误'}`);
  }
}
