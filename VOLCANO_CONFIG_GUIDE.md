# 火山引擎知识库配置指南

## 当前状态

✅ 已集成火山引擎知识库框架
✅ ServiceResourceId 已配置：`kb-service-1cad042ac4cd788d`
⚠️ 需要补充 API Key

## 配置步骤

### 1. 获取火山引擎 API Key

访问火山引擎知识库控制台（https://console.volcengine.com/mlp）：
1. 进入"知识库管理"
2. 找到你的知识库服务
3. 获取 API Key

### 2. 更新环境变量

编辑 `.env.local` 文件，补充以下配置：

```bash
VOLCANO_API_KEY=你的API_Key
```

**完整配置示例**：
```bash
VOLCANO_KNOWLEDGE_ENDPOINT=api-knowledgebase.mlp.cn-beijing.volces.com
VOLCANO_API_KEY=你的API_Key
VOLCANO_SERVICE_RESOURCE_ID=kb-service-1cad042ac4cd788d
```

### 3. 测试配置

使用测试API验证配置是否正确：

```bash
# 查看配置状态
curl http://localhost:5000/api/test-volcano

# 测试知识库检索
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"装修预算怎么分配？","topK":3}' \
  http://localhost:5000/api/test-volcano
```

### 4. 配置说明

#### 必填参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `VOLCANO_API_KEY` | 火山引擎知识库 API Key | `your_apikey` |
| `VOLCANO_SERVICE_RESOURCE_ID` | 知识库服务ID | `kb-service-1cad042ac4cd788d` ✅ |

#### 可选参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `VOLCANO_KNOWLEDGE_ENDPOINT` | `api-knowledgebase.mlp.cn-beijing.volces.com` | API端点 |

### 5. 工作原理

```
用户提问
    ↓
[装修助手] 意图识别
    ↓
[火山引擎知识库] 检索相关文档
    ↓
[千问 LLM] 结合知识库内容生成回答
    ↓
流式输出
```

### 6. API调用格式

根据火山引擎官方Python示例，API调用格式如下：

**请求端点**:
```
POST http://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/chat
```

**请求头**:
```json
{
  "Accept": "application/json",
  "Content-Type": "application/json;charset=UTF-8",
  "Host": "api-knowledgebase.mlp.cn-beijing.volces.com",
  "Authorization": "Bearer {your_apikey}"
}
```

**请求体**:
```json
{
  "service_resource_id": "kb-service-1cad042ac4cd788d",
  "messages": [
    {
      "role": "user",
      "content": "你的问题"
    }
  ],
  "stream": false
}
```

### 6. 备选方案

如果火山引擎知识库不可用，系统会自动降级到 Supabase 知识库：

1. Supabase 已配置 → 使用 Supabase
2. Supabase 未配置 → 返回空结果

## 常见问题

### Q1: 提示"未配置ApiKey"？

**A**: 检查 `.env.local` 文件中的 `VOLCANO_API_KEY` 是否填写。

### Q2: 检索结果为空？

**A**: 可能原因：
1. API Key 无权限访问该知识库服务
2. 知识库中没有相关内容
3. Service Resource ID 配置错误

### Q3: API调用失败？

**A**: 检查：
1. API Key 是否正确
2. 网络是否可以访问火山引擎API
3. Service Resource ID 是否正确

### Q4: 如何确认知识库有内容？

**A**:
1. 登录火山引擎控制台
2. 进入"知识库管理"
3. 查看知识库服务 `kb-service-1cad042ac4cd788d`
4. 确认是否有上传的文档

### Q5: Python示例中的SignerV4需要吗？

**A**: 不需要。根据官方Python示例，直接使用 Bearer Token 认证即可：
```typescript
headers: {
  'Authorization': `Bearer ${config.apiKey}`
}
```

## 代码示例

### 测试脚本

```typescript
// 测试火山引擎知识库
async function testVolcanoKnowledge() {
  const results = await searchKnowledge(
    '装修预算怎么分配？',
    3
  );

  console.log('检索结果:', results);
  console.log('结果数量:', results.length);

  if (results.length > 0) {
    console.log('第一条结果:', results[0]);
  }
}
```

### 在装修助手中使用

```typescript
// 装修助手会自动调用火山引擎知识库
// 在 knowledgeQA 节点中
export async function knowledgeQA(
  state: DecorationAssistantState
): Promise<DecorationAssistantState> {
  // 检索知识库
  const knowledgeResults = await searchKnowledge(state.userMessage, 3);

  // 格式化知识库上下文
  const knowledgeContext = formatKnowledgeContext(knowledgeResults);

  // 使用千问 LLM 结合知识库内容生成回答
  const response = await callQwenLLM([
    { role: 'system', content: DECORATION_SYSTEM_PROMPT },
    { role: 'user', content: `${knowledgeContext}\n\n用户问题：${state.userMessage}` }
  ], { enableSearch: true });

  return {
    ...state,
    knowledgeResults,
    llmResponse: response.content,
  };
}
```

## 下一步

1. ✅ 配置 API Key
2. ✅ 运行测试API验证配置
3. ⏳ 测试装修助手完整功能
4. ⏳ 根据测试结果优化检索参数

## Python vs TypeScript 对照

### Python 调用

```python
import json
import requests

g_knowledge_base_domain = "api-knowledgebase.mlp.cn-beijing.volces.com"
apikey = "your apikey"

query = "你的问题"

request_params = {
    "service_resource_id": "kb-service-1cad042ac4cd788d",
    "messages": [{"role": "user", "content": query}],
    "stream": False
}

headers = {
    'Authorization': f'Bearer {apikey}',
    'Content-Type': 'application/json;charset=UTF-8'
}

response = requests.post(
    f"http://{g_knowledge_base_domain}/api/knowledge/service/chat",
    headers=headers,
    json=request_params
)
```

### TypeScript 调用

```typescript
const config = {
  endpoint: "api-knowledgebase.mlp.cn-beijing.volces.com",
  apiKey: "your apikey",
  serviceResourceId: "kb-service-1cad042ac4cd788d"
};

const response = await fetch(
  `http://${config.endpoint}/api/knowledge/service/chat`,
  {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json;charset=UTF-8',
      'Host': config.endpoint,
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      service_resource_id: config.serviceResourceId,
      messages: [{ role: 'user', content: query }],
      stream: false
    })
  }
);
```

## 支持和反馈

如有问题，请检查：
1. `.env.local` 配置是否正确
2. 测试API返回结果
3. 火山引擎控制台的知识库服务配置
4. 确认 API Key 有访问该知识库服务的权限

## 官方文档

- 火山引擎知识库：https://www.volcengine.com/docs/82379
- 知识库管理控制台：https://console.volcengine.com/mlp
