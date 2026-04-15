// 测试火山引擎知识库 API

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const VOLCANO_API_KEY = process.env.VOLCANO_API_KEY || '';
  const VOLCANO_SERVICE_RESOURCE_ID = process.env.VOLCANO_SERVICE_RESOURCE_ID || '';
  const VOLCANO_ENDPOINT = process.env.VOLCANO_KNOWLEDGE_ENDPOINT || 'api-knowledgebase.mlp.cn-beijing.volces.com';

  console.log('[测试知识库] 开始测试火山引擎知识库');
  console.log('[测试知识库] API Key:', VOLCANO_API_KEY ? '已配置' : '未配置');
  console.log('[测试知识库] ServiceResourceId:', VOLCANO_SERVICE_RESOURCE_ID);

  if (!VOLCANO_API_KEY || VOLCANO_API_KEY === 'your_apikey') {
    return NextResponse.json({
      success: false,
      error: '未配置火山引擎 API Key',
      config: {
        hasApiKey: !!VOLCANO_API_KEY,
        serviceResourceId: VOLCANO_SERVICE_RESOURCE_ID,
      },
    });
  }

  try {
    const requestBody = {
      service_resource_id: VOLCANO_SERVICE_RESOURCE_ID,
      messages: [
        {
          role: 'user',
          content: '乳胶漆环保等级如何选择',
        }
      ],
      stream: false,
    };

    console.log('[测试知识库] 发送请求:', JSON.stringify({
      endpoint: VOLCANO_ENDPOINT,
      serviceResourceId: VOLCANO_SERVICE_RESOURCE_ID,
    }));

    const response = await fetch(
      `http://${VOLCANO_ENDPOINT}/api/knowledge/service/chat`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
          'Host': VOLCANO_ENDPOINT,
          'Authorization': `Bearer ${VOLCANO_API_KEY}`,
        },
        body: JSON.stringify(requestBody),
      }
    );

    console.log('[测试知识库] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[测试知识库] API调用失败:', response.status, errorText);
      return NextResponse.json({
        success: false,
        error: 'API调用失败',
        status: response.status,
        errorText,
      });
    }

    const data = await response.json();
    console.log('[测试知识库] 响应数据:', JSON.stringify(data, null, 2));

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[测试知识库] 测试失败:', error);
    return NextResponse.json({
      success: false,
      error: '测试失败',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
