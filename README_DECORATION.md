# 装修助手智能体 - 基于 LangGraph

## 项目概述

这是一个基于 LangGraph 框架的装修助手智能体，集成千问 LLM 和火山引擎知识库，提供三大核心功能：
1. **装修知识问答**：精准解答用户的装修知识疑问
2. **报价单检测**：高效分析装修报价单，生成专业检测报告
3. **方案设计**：设计个性化装修方案，提供可视化方案对比

## 技术架构

### 核心技术栈
- **框架**: LangGraph + Next.js 16
- **LLM**: 千问 (Qwen) API
- **知识库**: 火山引擎知识库（备选 Supabase）
- **数据库**: Supabase (PostgreSQL)
- **前端**: React 19 + TypeScript + Tailwind CSS
- **UI组件**: shadcn/ui

### 工作流架构

```
用户请求
    ↓
[意图识别节点]
    ↓
[技能路由]
    ↓
    ├──→ [知识问答节点] → 知识库检索 + 千问LLM
    ├──→ [报价单检测节点] → 文件解析 + 异常检测 + 报告生成
    └──→ [方案设计节点] → 需求收集 + 方案生成 + 对比分析
    ↓
[流式输出]
```

## 核心功能

### 技能 1: 装修知识问答

**触发条件**：用户提出单个具体装修问题

**处理流程**：
1. 从火山引擎知识库检索相关知识点
2. 使用千问LLM的联网搜索功能补充信息
3. 结合知识库和搜索结果生成专业回答

**输出特点**：
- 用生活化语言解释专业术语
- 结合实际案例说明
- 关键选项提供对比表

**示例对话**：
```
用户: 乳胶漆环保等级如何选？
助手: 国标E1级为基础，适合80㎡以下户型（案例：某小区业主用E0级乳胶漆后空气质量检测达标）。
建议选择E0级或ENF级，更环保但价格稍高。
```

### 技能 2: 报价单检测

**触发条件**：用户上传装修报价单

**处理流程**：
1. 解析报价单文件内容
2. 检测异常项目和价格波动
3. 生成可视化报告链接
4. 输出结构化检测报告

**输出内容**：
- 报价总额和异常项统计
- 价格波动预警（近3个月建材单价涨幅5%-12%）
- 潜在风险点分析
- 优化建议
- 可视化报告链接

**底部标注**：
> 本报告由AI生成，建议结合第三方评估调整；可视化报告链接有效期7天，请及时查看

### 技能 3: 装修方案设计

**触发条件**：用户提出明确的整体方案需求

**处理流程**：
1. **信息收集**：智能追问关键参数
2. **方案生成**：生成3套差异化方案（现代简约、日式侘寂、轻奢）
3. **可视化对比**：输出方案对比表

**输出内容**：
- 方案核心布局
- 材料搭配说明
- 预算分配方案
- 方案对比表

**底部标注**：
> 本方案非最终施工依据，建议提供CAD图纸至专业设计院复核后施工

## 文件结构

```
src/
├── lib/
│   ├── langgraph/
│   │   ├── decoration-types.ts      # 智能体状态定义
│   │   ├── decoration-nodes.ts      # 三大技能节点
│   │   └── decoration-workflow.ts   # 工作流构建
│   ├── llm/
│   │   └── qwen-client.ts           # 千问LLM客户端
│   ├── knowledge/
│   │   └── volcano-knowledge.ts     # 火山引擎知识库集成
│   └── rag/
│       ├── retrieval.ts             # RAG检索服务
│       ├── sample-docs.ts           # 示例文档
│       └── init.ts                  # 初始化脚本
├── app/
│   └── api/
│       ├── decoration-chat/         # 装修助手API
│       │   └── route.ts
│       └── kb/
│           └── init/                # 知识库初始化
│               └── route.ts
└── storage/
    └── database/
        ├── shared/
        │   └── schema.ts            # 数据库Schema
        └── supabase-client.ts       # Supabase客户端
```

## 环境配置

创建 `.env.local` 文件：

```bash
# 千问 LLM API
QWEN_API_KEY=sk-7eb36d090c544cf3a2c7c41bd4b06940

# 火山引擎知识库
VOLCANO_KNOWLEDGE_ENDPOINT=https://open.volcengineapi.com
VOLCANO_ACCESS_KEY=your_volcano_access_key
VOLCANO_SECRET_KEY=your_volcano_secret_key
VOLCANO_KNOWLEDGE_BASE_ID=decoration-kb
VOLCANO_REGION=cn-north-1

# Supabase（备选）
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 安装和运行

### 安装依赖

```bash
pnpm install
```

### 初始化知识库

```bash
curl -X POST http://localhost:5000/api/kb/init
```

### 启动开发服务器

```bash
pnpm dev
# 或
coze dev
```

## API 使用

### 装修助手 API

**端点**: `POST /api/decoration-chat`

**请求示例**：

```json
{
  "message": "客厅装修预算怎么分配？",
  "userId": "user_123",
  "conversationId": "conv_123"
}
```

**响应**：SSE 流式输出

**上传报价单**：

```json
{
  "message": "请帮我分析这个报价单",
  "files": [
    {
      "name": "装修报价单.pdf",
      "url": "https://example.com/quotation.pdf",
      "fileId": "file_123",
      "size": 1024000,
      "type": "application/pdf"
    }
  ],
  "userId": "user_123",
  "conversationId": "conv_123"
}
```

**请求方案设计**：

```json
{
  "message": "设计90㎡现代简约风格的全屋方案",
  "userId": "user_123",
  "conversationId": "conv_123"
}
```

### 知识库初始化 API

**端点**: `POST /api/kb/init`

**响应示例**：

```json
{
  "success": true,
  "message": "知识库初始化成功",
  "documentCount": 8
}
```

## 核心代码说明

### 1. 智能体状态定义

```typescript
interface DecorationAssistantState {
  // 用户输入
  userMessage: string;
  files?: FileInfo[];
  userId: string;
  conversationId: string;

  // 技能识别
  skillType: 'knowledge' | 'quotation' | 'design' | 'unknown';

  // 技能1: 知识问答
  knowledgeQuery?: string;
  knowledgeAnswer?: string;
  knowledgeResults?: KnowledgeResult[];

  // 技能2: 报价单检测
  quotationFile?: FileInfo;
  quotationReportUrl?: string;
  quotationAnalysis?: QuotationAnalysis;

  // 技能3: 方案设计
  designRequirements?: DesignRequirements;
  designProposals?: DesignProposal[];
  designComparison?: string;

  // LLM 响应
  llmResponse: string;
  thinking: string;

  // 流式输出
  isStreaming: boolean;
}
```

### 2. 意图识别节点

```typescript
export async function skillIdentificationNode(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  // 使用 LLM 识别技能类型
  const prompt = SKILL_IDENTIFICATION_PROMPT
    .replace('{user_message}', state.userMessage)
    .replace('{has_files}', hasFiles.toString());

  const response = await callQwenLLM([
    { role: 'user', content: prompt },
  ]);

  const skillType = response.content.trim().toLowerCase() as SkillType;

  return { ...state, skillType };
}
```

### 3. 千问 LLM 集成

```typescript
export async function callQwenLLM(
  messages: Message[],
  options?: { enableSearch?: boolean; }
): Promise<LLMResponse> {
  const requestBody = {
    model: 'qwen-max',
    messages,
    temperature: 0.7,
    max_tokens: 4000,
    tools: options?.enableSearch ? [{
      type: 'web_search',
      web_search: { enable: true },
    }] : [],
  };

  const response = await fetch(
    `${QWEN_CONFIG.baseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_CONFIG.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    thinking: data.choices[0].message.thinking,
  };
}
```

### 4. 火山引擎知识库集成

```typescript
export async function searchKnowledge(
  query: string,
  topK: number = 5
): Promise<KnowledgeSearchResult[]> {
  // 优先使用火山引擎知识库
  const volcanoResults = await searchVolcanoKnowledge(query, topK);

  if (volcanoResults.length > 0) {
    return volcanoResults;
  }

  // 降级到 Supabase 知识库
  const supabaseResults = await searchSupabaseKnowledge(query, topK);
  return supabaseResults;
}
```

## 三大技能对比

| 维度 | 知识问答 | 报价单检测 | 方案设计 |
|------|---------|-----------|---------|
| **触发条件** | 单个装修问题 | 上传报价单 | 整体方案需求 |
| **输入** | 文本消息 | 文件 + 文本 | 文本消息 |
| **输出** | 知识点解释 | 检测报告 | 3套方案 |
| **知识库** | ✅ 使用 | ✅ 使用 | ✅ 使用 |
| **联网搜索** | ✅ 使用 | ❌ 不使用 | ❌ 不使用 |
| **流式输出** | ✅ 支持 | ✅ 支持 | ✅ 支持 |
| **可视化** | ❌ 不需要 | ✅ 报告链接 | ✅ 对比表 |

## 注意事项

1. **火山引擎知识库集成**
   - 代码中提供了火山引擎知识库的接口框架
   - 实际使用时需要参考火山引擎官方文档补充 API 调用逻辑
   - 已提供 Supabase 作为备选知识库方案

2. **千问 LLM API**
   - 使用千问最强模型 `qwen-max`
   - 启用联网搜索功能
   - API Key 已提供：`sk-7eb36d090c544cf3a2c7c41bd4b06940`

3. **价格波动预警**
   - 报价单检测报告必须包含："近3个月建材单价涨幅5%-12%"提示

4. **方案标注**
   - 方案设计底部必须标注："本方案非最终施工依据，建议提供CAD图纸至专业设计院复核后施工"

5. **避免口语化**
   - 不使用"我觉得""应该"等表述
   - 改用"根据实测数据显示""行业标准要求"等专业表述

## 后续优化

1. **功能增强**
   - 实现真实的火山引擎知识库 API 调用
   - 完善报价单文件解析逻辑
   - 优化方案设计的信息提取

2. **性能优化**
   - 实现知识库向量索引
   - 优化 LLM 调用成本
   - 添加响应缓存机制

3. **用户体验**
   - 添加语音输入支持
   - 实现方案可视化（3D渲染）
   - 增加历史对话管理

## 许可证

MIT License
