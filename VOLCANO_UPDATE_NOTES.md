# 火山引擎知识库集成更新说明

## 更新内容

根据用户提供的 Python 示例代码，已将火山引擎知识库集成从 Ark API 更新为知识库 RAG API。

## 主要变更

### 1. API 端点变更

**之前**（Ark API）:
```
https://ark.cn-beijing.volces.com/api/v3/chat/completions
```

**现在**（知识库 API）:
```
http://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/chat
```

### 2. 认证方式变更

**之前**:
- 使用 AccessKey + SecretKey（SignerV4签名）
- 通过 tools 参数指定知识库

**现在**:
- 使用 Bearer Token（API Key）
- 直接指定 service_resource_id

### 3. 请求格式变更

**之前**:
```json
{
  "model": "ep-20250225110505-tqcmh",
  "messages": [{"role": "user", "content": "问题"}],
  "tools": [{
    "type": "knowledge",
    "knowledge": {
      "knowledge_base_ids": ["YOUR_API_KEY"],
      "top_k": 5
    }
  }]
}
```

**现在**:
```json
{
  "service_resource_id": "YOUR_SERVICE_RESOURCE_ID",
  "messages": [{"role": "user", "content": "问题"}],
  "stream": false
}
```

### 4. 环境变量变更

**之前**:
```bash
VOLCANO_KNOWLEDGE_ENDPOINT=https://ark.cn-beijing.volces.com/api/v3
VOLCANO_ACCESS_KEY=xxx
VOLCANO_SECRET_KEY=xxx
VOLCANO_KNOWLEDGE_BASE_ID=YOUR_API_KEY
```

**现在**:
```bash
VOLCANO_KNOWLEDGE_ENDPOINT=api-knowledgebase.mlp.cn-beijing.volces.com
VOLCANO_API_KEY=xxx
VOLCANO_SERVICE_RESOURCE_ID=YOUR_SERVICE_RESOURCE_ID
```

## 文件变更清单

### 1. src/lib/knowledge/volcano-knowledge.ts
- ✅ 更新配置对象
- ✅ 重写 searchVolcanoKnowledge 函数
- ✅ 适配新的 API 调用格式

### 2. .env.example
- ✅ 更新环境变量示例
- ✅ 移除不再需要的变量
- ✅ 添加新的必要变量

### 3. .env.local
- ✅ 更新实际配置
- ✅ 预设 ServiceResourceId

### 4. src/app/api/test-volcano/route.ts
- ✅ 更新配置检查逻辑
- ✅ 更新返回的配置信息

### 5. VOLCANO_CONFIG_GUIDE.md
- ✅ 更新配置说明
- ✅ 添加 API 调用格式说明
- ✅ 更新常见问题
- ✅ 添加 Python vs TypeScript 对照

## 需要用户操作

### 1. 配置 API Key

编辑 `.env.local` 文件，填写：
```bash
VOLCANO_API_KEY=你的火山引擎知识库API Key
```

### 2. 验证配置

```bash
# 查看配置状态
curl http://localhost:5000/api/test-volcano

# 测试知识库检索
curl -X POST -H "Content-Type: application/json" \
  -d '{"query":"装修预算怎么分配？","topK":3}' \
  http://localhost:5000/api/test-volcano
```

### 3. 测试完整功能

使用装修助手 API 测试知识库集成：
```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"message":"装修预算怎么分配？","userId":"test123","conversationId":"conv123"}' \
  http://localhost:5000/api/decoration-chat
```

## 技术细节

### 请求头

```typescript
headers: {
  'Accept': 'application/json',
  'Content-Type': 'application/json;charset=UTF-8',
  'Host': config.endpoint,
  'Authorization': `Bearer ${config.apiKey}`
}
```

### 响应解析

```typescript
// 从响应中提取知识库引用
if (data.choices && data.choices[0]) {
  const message = data.choices[0].message;

  // 方式1：从 knowledge_chunks 提取
  if (message.context?.knowledge_chunks) {
    // 处理知识库片段
  }

  // 方式2：从 content 提取（如果没有 knowledge_chunks）
  if (results.length === 0 && message.content) {
    // 处理内容
  }

  // 方式3：从 knowledge_results 提取（如果有）
  if (results.length === 0 && data.knowledge_results) {
    // 处理结果
  }
}
```

### 降级策略

```
火山引擎知识库
    ↓ 失败
Supabase 知识库（备选）
    ↓ 失败
返回空结果
```

## 注意事项

1. **API Key 安全**：不要将 `.env.local` 提交到版本控制
2. **网络要求**：确保服务器可以访问火山引擎 API
3. **权限验证**：确认 API Key 有访问指定知识库服务的权限
4. **ServiceResourceId**：必须与火山引擎控制台中的服务ID一致

## 测试清单

- [ ] 配置 API Key
- [ ] 测试配置状态接口
- [ ] 测试知识库检索接口
- [ ] 测试装修助手知识问答功能
- [ ] 验证知识库引用显示
- [ ] 确认降级机制正常工作

## 后续优化

1. 实现流式响应支持
2. 添加检索结果缓存
3. 优化结果相关性评分
4. 支持多轮对话上下文
5. 添加图片查询支持

## 参考资料

- 火山引擎知识库 Python SDK：https://www.volcengine.com/docs/82379
- 知识库管理控制台：https://console.volcengine.com/mlp
- 装修助手文档：README_DECORATION.md
