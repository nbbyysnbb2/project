// TextIn 文档解析客户端
// 用于解析PDF、Word等文档并提取文本内容

// 注意：根据官方文档，使用 v1 端点
const TEXTIN_API_BASE = 'https://api.textin.com/ai/service/v1/pdf_to_markdown';

const APP_ID = '837093845e34556c5ccd4660d935b362';
const SECRET_CODE = 'c08a1305656337db000b6f353fde520a';

export interface TextInParseResult {
  result: {
    markdown: string;
    success_count?: number;
    pages?: Array<{
      page_id: number;
      status: string;
      width: number;
      height: number;
      content: any[];
      structured: any[];
    }>;
    detail?: any[];
    total_page_number?: number;
    valid_page_number?: number;
  };
  code: number;
  message?: string;
  x_request_id?: string;
  duration?: number;
}

/**
 * 使用 TextIn API 解析 PDF 文件
 * @param fileUrl PDF 文件的在线 URL（必须是公网可访问的 URL）
 * @returns 解析后的文本内容
 */
export async function parsePdfWithTextIn(fileUrl: string): Promise<string> {
  try {
    console.log('[TextIn解析] 开始解析PDF');
    console.log('[TextIn解析] 文件URL:', fileUrl.substring(0, 100));
    console.log('[TextIn解析] 完整URL长度:', fileUrl.length);

    // 检查 URL 是否有效
    if (!fileUrl || !fileUrl.startsWith('http')) {
      throw new Error('文件URL无效，必须以 http 或 https 开头');
    }

    // 构建 URL 查询参数（根据官方文档，参数应该放在 URL 中）
    const params = new URLSearchParams({
      parse_mode: 'auto',  // auto 由引擎自动选择，适用范围最广
      dpi: '144',          // 文档坐标基准
      get_image: 'objects', // 获取markdown里的图片
      markdown_details: '1', // 返回detail字段
      page_count: '10',    // 解析前10页（快速解析）
      table_flavor: 'html', // 表格按html语法输出
      apply_document_tree: '1', // 生成标题层级
    });

    // 发送请求
    const requestUrl = `${TEXTIN_API_BASE}?${params.toString()}`;
    console.log('[TextIn解析] 请求URL:', requestUrl.substring(0, 100));

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'x-ti-app-id': APP_ID,
        'x-ti-secret-code': SECRET_CODE,
        'Content-Type': 'text/plain', // 使用URL方式时，Content-Type为text/plain
      },
      body: fileUrl, // 请求体是纯文本的URL
    });

    console.log('[TextIn解析] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[TextIn解析] API错误响应:', errorText);
      throw new Error(`TextIn API 错误 ${response.status}: ${errorText}`);
    }

    // 解析响应
    const result: TextInParseResult = await response.json();
    console.log('[TextIn解析] API响应code:', result.code);

    if (result.code !== 200) {
      const errorMsg = `TextIn API 返回错误: ${result.message} (code: ${result.code})`;
      console.error('[TextIn解析]', errorMsg);
      throw new Error(errorMsg);
    }

    // 提取 markdown 内容
    if (!result.result || !result.result.markdown) {
      console.error('[TextIn解析] 返回数据格式错误:', result);
      throw new Error('TextIn API 返回数据格式错误，缺少 markdown 字段');
    }

    const markdownContent = result.result.markdown;
    console.log('[TextIn解析] 解析成功，markdown长度:', markdownContent.length);
    console.log('[TextIn解析] markdown预览:', markdownContent.substring(0, 200));

    return markdownContent;
  } catch (error) {
    console.error('[TextIn解析] 解析失败:', error);
    throw new Error('PDF解析失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}

/**
 * 从 PDF 内容中提取纯文本（去除 markdown 格式）
 */
export function extractPlainTextFromMarkdown(markdown: string): string {
  // 移除 markdown 格式标记
  let text = markdown
    // 移除图片标记
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // 移除表格格式
    .replace(/\|[^|\n]*\|/g, '')
    // 移除代码块
    .replace(/```[\s\S]*?```/g, '')
    // 移除行内代码
    .replace(/`[^`]+`/g, '')
    // 移除标题标记
    .replace(/^#{1,6}\s+/gm, '')
    // 移除加粗和斜体
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // 移除链接
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 移除多余的空行
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return text;
}
