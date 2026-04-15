// 装修报价单检测类型定义

/**
 * 报价单检测状态
 */
export interface QuotationAnalysisState {
  // 输入
  fileUrl: string; // 文件URL（来自OSS）
  fileName: string; // 文件名

  // PDF解析
  pdfContent: string; // PDF文本内容

  // 知识库检索
  knowledgeQuery: string; // 检索查询
  knowledgeResults: any[]; // 检索结果
  knowledgeContext: string; // 知识库上下文

  // LLM分析结果
  structuredOutput: StructuredOutput; // 结构化分析结果

  // 报告生成
  htmlReport: string; // HTML报告
  reportUrl: string; // 报告在线URL

  // 元数据
  timestamp: number;

  // 流式处理字段
  intermediateResult?: string; // 中间结果（流式）
  processingTime?: number; // 处理时间
  isCompleted?: boolean; // 是否完成
}

/**
 * LLM结构化输出
 */
export interface StructuredOutput {
  // 基本信息
  file_source: string; // 报价单位、报价日期、联系人、电话等
  proprietor: string; // 施工地址、施工时间等业主信息

  // 问题列表
  issues: Issue[];
  issues_count: number | string; // 问题总数
  high_severity_count: number | string; // 高风险问题数

  // 评分和风险
  overall_score: number | string; // 整体评分（0-100）
  risk_level: 'high' | 'medium' | 'low'; // 风险等级

  // 总结
  summary: string; // 总体评价
}

/**
 * 问题项
 */
export interface Issue {
  category: string; // 问题类别
  severity: 'high' | 'medium' | 'low'; // 严重程度
  description: string; // 问题描述
  location: string; // 问题位置
  recommendation: string; // 整改建议
}

/**
 * HTML报告生成结果
 */
export interface ReportGenerationResult {
  html: string; // HTML内容
  reportUrl: string; // 在线URL
}
