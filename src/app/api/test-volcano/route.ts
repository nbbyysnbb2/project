// 火山引擎知识库测试API

import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/lib/knowledge/volcano-knowledge';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query = '装修预算怎么分配？', topK = 3 } = body;

    console.log('[测试] 开始测试火山引擎知识库:', { query, topK });

    // 检查配置
    const config = {
      endpoint: process.env.VOLCANO_KNOWLEDGE_ENDPOINT,
      apiKey: process.env.VOLCANO_API_KEY,
      serviceResourceId: process.env.VOLCANO_SERVICE_RESOURCE_ID,
    };

    console.log('[测试] 当前配置:', {
      endpoint: config.endpoint,
      hasApiKey: !!config.apiKey,
      serviceResourceId: config.serviceResourceId,
    });

    // 测试检索
    const results = await searchKnowledge(query, topK);

    return NextResponse.json({
      success: true,
      query,
      topK,
      resultCount: results.length,
      results,
      config: {
        endpoint: config.endpoint,
        hasApiKey: !!config.apiKey,
        serviceResourceId: config.serviceResourceId,
      },
    });
  } catch (error) {
    console.error('[测试] 测试失败:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: '火山引擎知识库测试接口',
    usage: 'POST with body: { "query": "搜索关键词", "topK": 3 }',
    config: {
      endpoint: process.env.VOLCANO_KNOWLEDGE_ENDPOINT,
      serviceResourceId: process.env.VOLCANO_SERVICE_RESOURCE_ID,
      hasApiKey: !!process.env.VOLCANO_API_KEY,
    },
  });
}
