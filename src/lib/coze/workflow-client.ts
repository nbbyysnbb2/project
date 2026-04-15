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
    this.apiToken = process.env.COZE_API_TOKEN || 'pat_8CjPbaUK3gT1hSH9gLLYQnCp86NpVJWW4xI9VhrPaJpXih4xLjbi12J9JykOqLDd';
    this.apiBase = process.env.COZE_API_BASE || 'https://api.coze.cn';
    this.workflowId = process.env.COZE_WORKFLOW_ID || '7579449153106133030';
    this.botId = process.env.COZE_BOT_ID || '7495951401416671272';

    console.log('[扣子工作流] 初始化完成');
    console.log('[扣子工作流] API Base:', this.apiBase);
    console.log('[扣子工作流] Workflow ID:', this.workflowId);
  }

  /**
   * 运行工作流（非流式）
   */
  async run(params: WorkflowRunParams = {}): Promise<string> {
    console.log('[扣子工作流] 开始运行工作流');
    console.log('[扣子工作流] Workflow ID:', this.workflowId);

    const url = `${this.apiBase}/v1/workflow/run`;

    // 构建请求体 - 根据用户提供的curl命令，传递workflow_id和parameters
    const requestBody: any = {
      workflow_id: this.workflowId,
      parameters: params.parameters || {},
    };

    // 只有当参数中明确传入了 bot_id 或 app_id 时才添加
    if (params.bot_id) {
      requestBody.bot_id = params.bot_id;
      console.log('[扣子工作流] 使用参数中的 bot_id:', params.bot_id);
    } else if (params.app_id) {
      requestBody.app_id = params.app_id;
      console.log('[扣子工作流] 使用参数中的 app_id:', params.app_id);
    }

    console.log('[扣子工作流] 请求URL:', url);
    console.log('[扣子工作流] 请求体:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('[扣子工作流] 响应状态:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[扣子工作流] API错误:', errorText);
        throw new Error(`工作流运行失败 (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('[扣子工作流] 响应结果:', JSON.stringify(result, null, 2));
      console.log('[扣子工作流] result.data 类型:', typeof result.data);

      // 返回工作流的输出
      // 注意：result.data 可能是一个JSON字符串，需要先解析
      if (result.code === 0 && result.data) {
        try {
          // 如果data是字符串，解析它
          let parsedData: any;
          if (typeof result.data === 'string') {
            console.log('[扣子工作流] data是字符串，尝试解析');
            parsedData = JSON.parse(result.data);
          } else {
            console.log('[扣子工作流] data是对象，直接使用');
            parsedData = result.data;
          }
          console.log('[扣子工作流] 解析后的data:', JSON.stringify(parsedData, null, 2));

          // 返回JSON字符串，让调用者可以解析出output和url
          return JSON.stringify(parsedData);
        } catch (parseError) {
          console.error('[扣子工作流] 解析data失败:', parseError);
          console.error('[扣子工作流] data内容:', result.data);
          // 如果解析失败，尝试直接使用data
          return JSON.stringify({ output: result.data });
        }
      }

      // 降级处理
      return JSON.stringify({ output: result.data?.output || result.data?.content, url: result.data?.url });
    } catch (error) {
      console.error('[扣子工作流] 运行失败:', error);
      throw new Error(`扣子工作流运行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 运行工作流（流式）
   */
  async *runStream(params: WorkflowRunParams = {}): AsyncGenerator<WorkflowEvent> {
    console.log('[扣子工作流] 开始流式运行工作流');
    console.log('[扣子工作流] Workflow ID:', this.workflowId);

    const url = `${this.apiBase}/v1/workflow/stream_run`;

    // 构建请求体 - 根据用户提供的curl命令，传递workflow_id和parameters
    const requestBody: any = {
      workflow_id: this.workflowId,
      parameters: params.parameters || {},
    };

    // 只有当参数中明确传入了 bot_id 或 app_id 时才添加
    if (params.bot_id) {
      requestBody.bot_id = params.bot_id;
      console.log('[扣子工作流] 使用参数中的 bot_id:', params.bot_id);
    } else if (params.app_id) {
      requestBody.app_id = params.app_id;
      console.log('[扣子工作流] 使用参数中的 app_id:', params.app_id);
    }

    console.log('[扣子工作流] 请求URL:', url);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[扣子工作流] API错误:', errorText);
        throw new Error(`工作流运行失败 (${response.status}): ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 处理SSE格式的数据
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留最后一个不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { event: 'done' };
              return;
            }

            try {
              const event: WorkflowEvent = JSON.parse(data);
              console.log('[扣子工作流] 收到事件:', JSON.stringify(event, null, 2));
              yield event;
            } catch (e) {
              console.warn('[扣子工作流] 解析事件失败:', data);
            }
          }
        }
      }
    } catch (error) {
      console.error('[扣子工作流] 流式运行失败:', error);
      throw new Error(`扣子工作流流式运行失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }

  /**
   * 运行报价单检测工作流
   */
  async detectQuotation(pdfUrl: string): Promise<string> {
    console.log('[扣子工作流] 开始报价单检测');
    console.log('[扣子工作流] PDF URL:', pdfUrl);

    // 根据错误信息，工作流需要 'input' 参数
    // 传递PDF URL作为 input 参数
    return this.run({
      parameters: {
        input: pdfUrl,  // 工作流需要的参数名是 'input'
      }
    });
  }

  /**
   * 流式运行报价单检测工作流
   */
  async *detectQuotationStream(pdfUrl: string): AsyncGenerator<WorkflowEvent> {
    console.log('[扣子工作流] 开始流式报价单检测');
    console.log('[扣子工作流] PDF URL:', pdfUrl);

    yield* this.runStream({
      parameters: {
        input: pdfUrl,  // 工作流需要的参数名是 'input'
      }
    });
  }
}

// 导出单例
export const cozeWorkflowClient = new CozeWorkflowClient();
