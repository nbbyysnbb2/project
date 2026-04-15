/**
 * 扣子工作流API客户端
 * 用于调用扣子工作流进行装修报价单检测
 */

export interface WorkflowEvent {
  event: 'message' | 'error' | 'interrupt' | 'done';
  message?: string;
  error?: string;
  interrupt?: {
    interrupt_data: {
      event_id: string;
      type: string;
    };
  };
  data?: any;
}

export interface WorkflowRunParams {
  parameters?: Record<string, any>;
  bot_id?: string;
  app_id?: string;
  additional_messages?: Array<{
    role: string;
    content: string;
    content_type: string;
  }>;
}

export class CozeWorkflowClient {
  private apiToken: string;
  private apiBase: string;
  private workflowId: string;
  private botId?: string;

  constructor() {
    this.apiToken = process.env.COZE_API_TOKEN || '';
    this.apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn';
    this.workflowId = process.env.COZE_WORKFLOW_ID || '';
    this.botId = process.env.COZE_BOT_ID || undefined;

    console.log('[扣子工作流] 初始化完成');
    console.log('[扣子工作流] API Base:', this.apiBase);
    console.log('[扣子工作流] Workflow ID:', this.workflowId);
  }

  /**
   * 运行工作流（非流式）
   */
  async run(params: WorkflowRunParams = {}): Promise<string> {
