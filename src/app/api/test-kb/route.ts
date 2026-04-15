// 测试火山引擎知识库 API

import { NextRequest, NextResponse } from 'next/server';
import { searchKnowledge } from '@/lib/knowledge/volcano-knowledge';

export async function GET(request: NextRequest) {
  console.log('[测试知识库] 开始测试');

  try {
    const query = '乳胶漆环保等级';
    console.log('[测试知识库] 查询:', query);

    const results = await searchKnowledge(query, 5);
    console.log('[测试知识库] 结果数量:', results.length);

    const formattedResults = results.map((r, idx) => ({
      index: idx + 1,
      title: r.title,
      content: r.content?.substring(0, 200) + '...',
      url: r.source, // source 字段表示来源URL
      score: r.confidence, // confidence 字段表示相关性分数
    }));

    return NextResponse.json({
      success: true,
      query,
      total: results.length,
      results: formattedResults,
    });
  } catch (error) {
    console.error('[测试知识库] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 500 }
    );
  }
}
