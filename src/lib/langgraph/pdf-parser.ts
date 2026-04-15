// PDF解析工具
// 使用 TextIn API 解析PDF文件

import { parsePdfWithTextIn } from '../pdf/textin-client';

/**
 * 解析PDF文件内容（从buffer）
 * 注意：此函数已废弃，请使用 parsePdfFromUrl
 */
export async function parsePdf(buffer: Buffer): Promise<string> {
  throw new Error('请使用 parsePdfFromUrl 函数，该函数使用 TextIn API 解析 PDF');
}

/**
 * 从URL下载并解析PDF文件（使用 TextIn API）
 * @param url PDF文件的在线URL
 * @returns 解析后的 markdown 内容（保留格式）
 */
export async function parsePdfFromUrl(url: string): Promise<string> {
  try {
    console.log('[PDF解析] 从URL解析PDF:', url.substring(0, 100));

    // 使用 TextIn API 解析 PDF，返回 markdown 格式
    const markdownContent = await parsePdfWithTextIn(url);

    console.log('[PDF解析] 解析完成，markdown长度:', markdownContent.length);
    console.log('[PDF解析] markdown预览:', markdownContent.substring(0, 200));

    // 直接返回 markdown 内容（保留格式，用于后续的LLM分析和知识库检索）
    return markdownContent;
  } catch (error) {
    console.error('[PDF解析] 从URL解析失败:', error);
    console.error('[PDF解析] 错误详情:', error instanceof Error ? error.stack : String(error));
    throw new Error('PDF文件下载或解析失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}
