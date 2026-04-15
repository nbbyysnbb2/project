// 火山引擎知识库集成服务
// 注意：以下代码基于火山引擎知识库API设计，具体实现需根据实际API文档调整

/**
 * 知识库检索结果接口
 */
export interface KnowledgeSearchResult {
  id?: string;
  title: string;
  content: string;
  category: string;
  source: string;
  confidence: number;
  metadata?: Record<string, any>;
}

/**
 * 知识库配置
 */
const KNOWLEDGE_CONFIG = {
  // 火山引擎知识库配置
  volcanoKnowledge: {
    endpoint: process.env.VOLCANO_KNOWLEDGE_ENDPOINT || 'api-knowledgebase.mlp.cn-beijing.volces.com',
    apiKey: process.env.VOLCANO_API_KEY || '',
    serviceResourceId: process.env.VOLCANO_SERVICE_RESOURCE_ID || '',
  },
};

/**
 * 从火山引擎知识库检索（使用RAG API）
 * 参考 Python 示例：https://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/chat
 */
async function searchVolcanoKnowledge(
  query: string,
  topK: number = 5
): Promise<KnowledgeSearchResult[]> {
  process.stdout.write(`[火山引擎知识库] 开始检索: query=${query}, topK=${topK}\n`);

  try {
    console.log('[火山引擎知识库] 开始检索:', { query, topK });

    const config = KNOWLEDGE_CONFIG.volcanoKnowledge;

    // 如果没有配置apiKey，返回空结果
    if (!config.apiKey || config.apiKey === 'your_apikey') {
      console.log('[火山引擎知识库] 未配置ApiKey，跳过火山引擎检索');
      return [];
    }

    // 使用火山引擎知识库 API
    // 参考 Python 示例的请求格式
    const requestBody = {
      service_resource_id: config.serviceResourceId,
      messages: [
        {
          role: 'user',
          content: query,
        }
      ],
      stream: false,
    };

    console.log('[火山引擎知识库] 请求参数:', {
      endpoint: config.endpoint,
      serviceResourceId: config.serviceResourceId,
      query,
    });

    const response = await fetch(
      `http://${config.endpoint}/api/knowledge/service/chat`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'Host': config.endpoint,
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[火山引擎知识库] API调用失败:', response.status, errorText);
      return [];
    }

    const data = await response.json();

    console.log('[火山引擎知识库] 响应数据code:', data.code);

    // 解析知识库检索结果
    const results: KnowledgeSearchResult[] = [];

    // 检查实际返回的数据结构
    if (data.code === 0 && data.data && data.data.result_list) {
      // 火山引擎知识库实际返回的数据结构
      const resultList = data.data.result_list;

      console.log('[火山引擎知识库] 找到result_list，数量:', resultList.length);

      resultList.forEach((item: any, index: number) => {
        results.push({
          id: item.id || item.point_id || `${index}`,
          title: item.chunk_title || item.doc_info?.title || item.doc_info?.doc_name || `知识库片段 ${index + 1}`,
          content: item.content || item.text || '',
          category: item.doc_info?.doc_name || '装修知识',
          source: item.doc_info?.doc_name || '火山引擎知识库',
          confidence: item.score || 0.8,
          metadata: {
            ...item,
            serviceResourceId: config.serviceResourceId,
          },
        });
      });
    } else {
      console.log('[火山引擎知识库] 响应结构不符合预期，code:', data.code, '有data:', !!data.data, '有result_list:', !!(data.data && data.data.result_list));
    }

    console.log('[火山引擎知识库] 检索结果:', results.length);
    console.log('[火山引擎知识库] 结果详情（前2条）:', JSON.stringify(results.slice(0, 2), null, 2));

    return results;
  } catch (error) {
    console.error('[火山引擎知识库] 检索失败:', error);
    return [];
  }
}

/**
 * 从知识库检索
 */
export async function searchKnowledge(
  query: string,
  topK: number = 5
): Promise<KnowledgeSearchResult[]> {
  try {
    const volcanoResults = await searchVolcanoKnowledge(query, topK);
    console.log('[知识库] 检索结果:', volcanoResults.length);
    return volcanoResults;
  } catch (error) {
    console.error('[知识库] 检索失败:', error);
    return [];
  }
}

/**
 * 格式化知识库检索结果为上下文
 */
export function formatKnowledgeContext(
  results: KnowledgeSearchResult[]
): string {
  if (results.length === 0) {
    return '';
  }

  const context = `
参考知识库内容：
${results
  .map(
    (result, index) => `
[${index + 1}] ${result.title} (${result.category})
来源：${result.source}
内容：${result.content}
`
  )
  .join('\n')}
`;

  console.log('[知识库] 格式化上下文，长度:', context.length);

  return context;
}
