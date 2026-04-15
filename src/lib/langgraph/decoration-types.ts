// 装修助手智能体类型定义
// 定义了智能体工作流中使用的所有接口和类型

/**
 * 文件信息接口
 */
export interface FileInfo {
  name: string;
  url: string;
  fileId?: string;
  size: number;
  type: string;
}

/**
 * 知识库检索结果接口
 */
export interface KnowledgeResult {
  id?: string; // 知识库条目ID
  title: string;
  content: string;
  category: string;
  source: string; // 来源URL或文档名称
  confidence: number; // 相关性分数 (0-1)
  url?: string; // 来源URL（可选）
  score?: number; // 相关性分数（可选，与confidence字段相同）
  metadata?: Record<string, any>; // 额外元数据
}

/**
 * 报价单分析结果
 */
export interface QuotationAnalysis {
  totalAmount: number; // 总金额
  abnormalItems: Array<{
    item: string;
    price: number;
    marketPrice: number;
    reason: string;
  }>; // 异常项目
  priceWarning: string; // 价格警告
  riskPoints: string[]; // 风险点
  suggestions: string[]; // 建议
}

/**
 * 设计要求
 */
export interface DesignRequirements {
  style: string; // 风格
  budget: number; // 预算
  area: number; // 面积
  specialRequirements?: string[]; // 特殊要求
}

/**
 * 设计方案
 */
export interface DesignProposal {
  style: string;
  description: string;
  estimatedCost: number;
  pros: string[];
  cons: string[];
}

/**
 * 图片风格分析结果
 */
export interface ImageAnalysisResult {
  styleName: string; // 风格名称
  styleBasis: string; // 判定依据
  features: string[]; // 关键特征
  pros: string[]; // 优点
  cons: string[]; // 缺点
  budgetRange: {
    total: string; // 整体预算区间
    hardDecoration: string; // 硬装预算
    softDecoration: string; // 软装预算
    breakdown?: string; // 分项成本
  }; // 预算估算
  suggestions: string[]; // 优化建议
  isMixedStyle?: boolean; // 是否为混合风格
  styleDistribution?: string; // 风格分布（如果是混合风格）
}

/**
 * 技能类型
 */
export type SkillType = 'knowledge' | 'quotation' | 'design' | 'image_analysis' | 'unknown';

/**
 * 装修助手智能体状态
 * 定义了智能体在工作流中的完整状态
 */
export interface DecorationAssistantState {
  // ========== 输入 ==========
  userMessage: string; // 用户消息
  userId: string; // 用户ID
  conversationId: string; // 对话ID
  files?: FileInfo[]; // 上传的文件（可选）

  // ========== 意图识别 ==========
  skillType: SkillType; // 识别的技能类型

  // ========== 技能1: 知识问答 ==========
  knowledgeQuery?: string; // 知识库查询
  knowledgeAnswer?: string; // 知识库回答
  knowledgeContext?: string; // 知识库上下文
  knowledgeResults?: KnowledgeResult[]; // 知识库检索结果

  // ========== 技能2: 报价单检测 ==========
  quotationFile?: FileInfo; // 报价单文件
  quotationReportUrl?: string; // 报告URL
  quotationAnalysis?: QuotationAnalysis; // 报价单分析结果

  // ========== 技能3: 方案设计 ==========
  designRequirements?: DesignRequirements; // 设计要求
  designProposals?: DesignProposal[]; // 设计方案
  designComparison?: string; // 方案对比

  // ========== 技能4: 图片风格分析 ==========
  imageFile?: FileInfo; // 图片文件
  imageAnalysisResult?: ImageAnalysisResult; // 图片分析结果
  imageAnalysisReport?: string; // 图片分析报告

  // ========== LLM 响应 ==========
  llmResponse: string; // 最终响应
  thinking: string; // 思考过程
  reasoning: string; // 推理过程

  // ========== 联网搜索 ==========
  webSearchResults?: Array<{
    title: string;
    url: string;
    snippet: string;
  }>; // 联网搜索结果

  // ========== 流式输出 ==========
  isStreaming: boolean; // 是否流式输出
  responseChunks: string[]; // 响应分块

  // ========== 元数据 ==========
  timestamp: number; // 时间戳
  metadata: Record<string, any>; // 额外元数据
}

/**
 * 创建初始状态
 */
export const createInitialState = (
  userMessage: string,
  userId: string,
  conversationId: string,
  files?: FileInfo[]
): DecorationAssistantState => ({
  userMessage,
  userId,
  conversationId,
  files,
  skillType: 'knowledge',
  llmResponse: '',
  thinking: '',
  reasoning: '',
  isStreaming: false,
  responseChunks: [],
  timestamp: Date.now(),
  metadata: {},
});
