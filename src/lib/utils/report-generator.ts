// 装修报价单HTML报告生成工具

import type { StructuredOutput } from '../langgraph/quotation-types';

/**
 * 生成报价单HTML报告
 * 复现扣子代码节点的HTML生成逻辑
 */
export function generateQuotationReport(data: StructuredOutput): string {
  // 确保有默认值
  const {
    proprietor = '',
    file_source = '',
    summary = '',
    risk_level = 'low',
    overall_score = 0,
    issues_count = 0,
    high_severity_count = 0,
    issues = [],
  } = data;

  // 统计计算
  const severity_low = issues.filter((i) => i.severity === 'low').length;
  const severity_medium = issues.filter((i) => i.severity === 'medium').length;
  const severity_high = issues.filter((i) => i.severity === 'high').length;
  const total_issues = Number(issues.length || issues_count);

  // 占比计算
  const severity_low_pct =
    total_issues > 0 ? ((severity_low / total_issues) * 100).toFixed(1) : 0;
  const severity_medium_pct =
    total_issues > 0 ? ((severity_medium / total_issues) * 100).toFixed(1) : 0;
  const severity_high_pct =
    total_issues > 0 ? ((severity_high / total_issues) * 100).toFixed(1) : 0;

  // 高风险占比
  const high_risk_ratio =
    Number(issues_count) > 0 ? ((Number(high_severity_count) / Number(issues_count)) * 100).toFixed(1) : 0;

  // 评分进度条
  const score_percentage = Math.min(100, Math.max(0, (Number(overall_score) / 100) * 100));
  let score_color = '#4ade80';
  if (score_percentage >= 80) score_color = '#4ade80';
  else if (score_percentage >= 60) score_color = '#facc15';
  else if (score_percentage >= 40) score_color = '#f97316';
  else score_color = '#ef4444';

  // 风险等级颜色映射
  const riskColorMap = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#ef4444',
  };
  const riskBgColorMap = {
    low: 'rgba(16, 185, 129, 0.15)',
    medium: 'rgba(245, 158, 11, 0.15)',
    high: 'rgba(239, 68, 68, 0.15)',
  };
  const riskBorderColorMap = {
    low: 'rgba(16, 185, 129, 0.3)',
    medium: 'rgba(245, 158, 11, 0.3)',
    high: 'rgba(239, 68, 68, 0.3)',
  };

  const current_risk_color = riskColorMap[risk_level as keyof typeof riskColorMap];
  const current_risk_bg = riskBgColorMap[risk_level as keyof typeof riskBgColorMap];
  const current_risk_border =
    riskBorderColorMap[risk_level as keyof typeof riskBorderColorMap];

  // 生成问题表格行
  const issueRows = issues
    .map(
      (issue, idx) => `
<tr class="issue-row" data-index="${idx + 1}">
  <td class="text-center font-medium">${idx + 1}</td>
  <td>${issue.category}</td>
  <td>
    <span class="severity-badge ${issue.severity}">${issue.severity.toUpperCase()}</span>
  </td>
  <td class="description-cell">${issue.description}</td>
  <td>${issue.location}</td>
  <td class="recommendation-cell">${issue.recommendation}</td>
</tr>`
    )
    .join('');

  // 生成统计表格行
  const severityTableRows = `
<tr>
  <td>低风险</td>
  <td class="text-center">${severity_low}</td>
  <td class="text-center">${severity_low_pct}%</td>
  <td>
    <div class="score-progress" style="width: 100%;">
      <div class="score-progress-bar" style="width: ${severity_low_pct}%; background-color: #10b981;"></div>
    </div>
  </td>
</tr>
<tr>
  <td>中风险</td>
  <td class="text-center">${severity_medium}</td>
  <td class="text-center">${severity_medium_pct}%</td>
  <td>
    <div class="score-progress" style="width: 100%;">
      <div class="score-progress-bar" style="width: ${severity_medium_pct}%; background-color: #f59e0b;"></div>
    </div>
  </td>
</tr>
<tr>
  <td>高风险</td>
  <td class="text-center">${severity_high}</td>
  <td class="text-center">${severity_high_pct}%</td>
  <td>
    <div class="score-progress" style="width: 100%;">
      <div class="score-progress-bar" style="width: ${severity_high_pct}%; background-color: #ef4444;"></div>
    </div>
  </td>
</tr>`;

  // 类别统计
  const categoryStats: Record<string, number> = {};
  issues.forEach((issue) => {
    const cate = issue.category || '未分类';
    categoryStats[cate] = (categoryStats[cate] || 0) + 1;
  });

  const categoryTableRows = Object.entries(categoryStats)
    .map(([cate, count]) => {
      const pct = total_issues > 0 ? ((count / total_issues) * 100).toFixed(1) : 0;
      return `
<tr>
  <td>${cate}</td>
  <td class="text-center">${count}</td>
  <td class="text-center">${pct}%</td>
</tr>`;
    })
    .join('');

  // 生成时间
  const nowIso = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const analysisTime = new Date().toISOString();

  // 生成HTML
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>装修报价单分析报告</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  font-family: 'Inter', sans-serif;
}

body {
  background: #f9fafb;
  color: #1f2937;
  padding: 1rem;
  line-height: 1.5;
}

.container {
  max-width: 1200px;
  margin: 2rem auto;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
  padding: 2rem;
}

.header {
  border-bottom: 2px solid #f3f4f6;
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
  position: relative;
}

.header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  width: 80px;
  height: 2px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  border-radius: 9999px;
}

.header h1 {
  font-size: 2rem;
  font-weight: 700;
  text-align: center;
  background: linear-gradient(90deg, #6366f1, #8b5cf6);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: 1rem;
}

.header-info {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;
}

.header-info .info-item {
  background: #f9fafb;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid #e5e7eb;
  font-size: 0.95rem;
}

.header-info .info-item strong {
  color: #6366f1;
}

/* 评分卡片 */
.score-card {
  text-align: center;
  padding: 2rem;
  border-radius: 1rem;
  margin-bottom: 2rem;
  background: linear-gradient(135deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05));
  border: 1px solid #e5e7eb;
}

.score {
  font-size: 4rem;
  font-weight: 800;
  margin: 1rem 0;
  color: #111827;
}

.score-progress {
  width: 80%;
  height: 12px;
  background: #e5e7eb;
  border-radius: 9999px;
  margin: 1rem auto;
  overflow: hidden;
}

.score-progress-bar {
  height: 100%;
  border-radius: 9999px;
  width: ${score_percentage}%;
  background: ${score_color};
  transition: width 1s ease;
}

.risk-level {
  display: inline-block;
  padding: 0.4rem 1.2rem;
  border-radius: 9999px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 2px;
  background: ${current_risk_bg};
  color: ${current_risk_color};
  border: 1px solid ${current_risk_border};
}

/* 总结模块 */
.summary-section {
  background: #f9fafb;
  padding: 1.5rem;
  border-radius: 0.75rem;
  margin-bottom: 2rem;
  border-left: 4px solid #6366f1;
}

.summary-section h2 {
  font-size: 1.3rem;
  font-weight: 600;
  margin-bottom: 0.8rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-section h2::before {
  content: '📝';
  font-size: 1.2rem;
}

.summary-section p {
  color: #4b5563;
  line-height: 1.8;
  text-indent: 2em;
}

/* 统计卡片 */
.stats-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: white;
  padding: 1.5rem;
  border-radius: 1rem;
  text-align: center;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  transition: transform 0.3s ease;
}

.stat-card.high-severity {
  background: linear-gradient(135deg, #ef4444, #f87171);
}

.stat-card.risk-ratio {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-label {
  font-size: 1.1rem;
  font-weight: 500;
  opacity: 0.9;
  margin-bottom: 0.5rem;
}

.stat-number {
  font-size: 3.5rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-sub {
  font-size: 1.2rem;
  opacity: 0.8;
  margin-top: 0.5rem;
}

/* 表格样式 */
.issues-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  margin-bottom: 2rem;
}

.issues-table thead {
  background: linear-gradient(90deg, #1f2937, #111827);
  color: white;
}

.issues-table th {
  padding: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
}

.issues-table td {
  padding: 1rem;
  border-bottom: 1px solid #e5e7eb;
  font-size: 0.95rem;
}

.issue-row:hover {
  background: #f9fafb;
}

/* 徽章样式 */
.severity-badge {
  display: inline-block;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.severity-badge.low {
  background: rgba(16,185,129,0.15);
  color: #10b981;
  border: 1px solid rgba(16,185,129,0.3);
}

.severity-badge.medium {
  background: rgba(245,158,11,0.15);
  color: #f59e0b;
  border: 1px solid rgba(245,158,11,0.3);
}

.severity-badge.high {
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  border: 1px solid rgba(239,68,68,0.3);
}

.text-center {
  text-align: center;
}

/* 页脚 */
.footer {
  border-top: 1px solid #e5e7eb;
  padding-top: 1.5rem;
  text-align: center;
  color: #4b5563;
  font-size: 0.9rem;
  margin-top: 2rem;
}
  </style>
</head>
<body>
  <div class="container">
    <!-- 头部 -->
    <div class="header">
      <h1>装修报价单分析报告</h1>
      <div class="header-info">
        <div class="info-item">
          <strong>工程信息:</strong> ${proprietor || '未填写'}
        </div>
        <div class="info-item">
          <strong>报价信息:</strong> ${file_source || '未填写'}
        </div>
        <div class="info-item">
          <strong>分析时间:</strong> ${nowIso}
        </div>
      </div>
    </div>

    <!-- 评分卡片 -->
    <div class="score-card ${risk_level}">
      <h2>整体评分</h2>
      <div class="score">${Number(overall_score).toFixed(1)}</div>
      <div class="score-progress">
        <div class="score-progress-bar"></div>
      </div>
      <div class="risk-level">风险等级: ${risk_level.toUpperCase()}</div>
    </div>

    <!-- 总结模块 -->
    <div class="summary-section">
      <h2>总体评价</h2>
      <p>${summary || '暂无评价信息'}</p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-container">
      <div class="stat-card">
        <div class="stat-label">发现问题总数</div>
        <div class="stat-number">${issues_count}</div>
      </div>
      <div class="stat-card high-severity">
        <div class="stat-label">高风险问题数量</div>
        <div class="stat-number">${high_severity_count}</div>
      </div>
      <div class="stat-card risk-ratio">
        <div class="stat-label">高风险占比</div>
        <div class="stat-number">${high_risk_ratio}%</div>
        <div class="stat-sub">(${high_severity_count}/${issues_count})</div>
      </div>
    </div>

    <!-- 问题列表 -->
    <div style="margin-bottom: 2rem;">
      <h2 style="font-size: 1.3rem; font-weight: 600; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
        <span>⚠️</span> 问题详情
      </h2>
      <table class="issues-table">
        <thead>
          <tr>
            <th class="text-center">序号</th>
            <th>问题类别</th>
            <th>严重程度</th>
            <th>问题描述</th>
            <th>问题位置</th>
            <th>整改建议</th>
          </tr>
        </thead>
        <tbody>
          ${issueRows || '<tr><td colspan="6" class="text-center py-4 text-gray-500">暂无问题数据</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- 页脚 -->
    <div class="footer">
      <p>报告生成时间: ${nowIso}</p>
      <p>温馨提示：本报告由AI生成，建议结合实际情况核实细节</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

/**
 * 发布HTML报告
 * 使用 AI Conductor 的 HTML 发布 API
 */
export async function publishHtmlReport(html: string, fileName: string): Promise<string> {
  try {
    console.log('[报告生成] 开始发布HTML报告');
    console.log('[报告生成] 文件名:', fileName);
    console.log('[报告生成] HTML长度:', html.length);

    // AI Conductor API 配置
    const API_URL = 'http://plugin.aiconductor.fun/api/html_publish';
    const API_KEY = 'YOUR_API_KEY';

    // 构建请求体
    const requestBody = {
      api_key: API_KEY,
      html_code: html,
      title: fileName.replace(/\.[^/.]+$/, '') // 移除文件扩展名
    };

    console.log('[报告生成] 请求URL:', API_URL);
    console.log('[报告生成] 请求体标题:', requestBody.title);

    // 发送请求
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('[报告生成] 响应状态:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[报告生成] API错误响应:', errorText);
      throw new Error(`HTML发布失败 (${response.status}): ${errorText}`);
    }

    // 解析响应
    const result = await response.json();
    console.log('[报告生成] API响应:', JSON.stringify(result, null, 2));

    // 检查响应格式
    if (!result.online_url) {
      console.error('[报告生成] API响应缺少online_url字段，完整响应:', JSON.stringify(result, null, 2));
      throw new Error('HTML发布API返回的数据格式错误，缺少online_url字段');
    }

    const reportUrl = result.online_url;
    console.log('[报告生成] HTML报告发布成功:', reportUrl);

    return reportUrl;
  } catch (error) {
    console.error('[报告生成] HTML报告发布失败:', error);
    throw new Error('HTML报告发布失败: ' + (error instanceof Error ? error.message : '未知错误'));
  }
}
