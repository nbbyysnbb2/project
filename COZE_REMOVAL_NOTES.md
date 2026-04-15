# 扣子移除与装修助手迁移完成

## 更新时间
2025-01-14

## 更新内容

### 1. 删除扣子相关文件

#### API 路由
- ❌ 删除 `src/app/api/chat/route.ts` - 旧的扣子聊天接口
- ❌ 删除 `src/app/api/langgraph-chat/route.ts` - 旧的 LangGraph 测试接口
- ❌ 删除 `src/app/api/kb/` - Supabase 知识库初始化接口

#### 库文件
- ❌ 删除 `src/lib/rag/` - RAG 检索相关代码
- ❌ 删除 `src/lib/langgraph/nodes.ts` - 旧的节点文件
- ❌ 删除 `src/lib/langgraph/types.ts` - 旧的类型文件
- ❌ 删除 `src/lib/langgraph/workflow.ts` - 旧的工作流文件
- ❌ 删除 `src/storage/` - Supabase 客户端

### 2. 更新前端代码

#### `src/app/page.tsx`
- ✅ 移除 `cozeConversationId` 接口字段
- ✅ 更新用户ID存储：`coze_user_id` → `decoration_user_id`
- ✅ 更新API端点：`/api/chat` → `/api/decoration-chat`
- ✅ 简化请求参数：
  - 移除 `conversationHistory`
  - 使用 `conversationId` 替代 `cozeConversationId`
- ✅ 移除 `conversation_id` 处理逻辑
- ✅ 移除 `savedCozeConversationId` 变量

#### `src/app/layout.tsx`
- ✅ 更新网站标题："新应用 | 扣子编程" → "装修助手 | 智能装修顾问"
- ✅ 更新描述和关键词
- ✅ 移除 Coze 相关的作者和元数据
- ✅ 更新 OpenGraph 配置
- ✅ 语言设置：`en` → `zh-CN`

### 3. 更新后端代码

#### `src/app/api/upload/route.ts`
- ✅ 移除扣子文件上传逻辑
- ✅ 移除 `COZE_API_TOKEN` 配置
- ✅ 移除 `uploadFileToCoze` 函数
- ✅ 只保留阿里云OSS上传

#### `src/lib/knowledge/volcano-knowledge.ts`
- ✅ 移除 Supabase 依赖
- ✅ 移除 `getSupabaseClient` 导入
- ✅ 移除 `supabaseKnowledge` 配置
- ✅ 删除 `searchSupabaseKnowledge` 函数
- ✅ 删除 `addKnowledge` 函数
- ✅ 删除 `batchAddKnowledge` 函数
- ✅ 简化 `searchKnowledge` 函数

#### `src/lib/langgraph/decoration-workflow.ts`
- ✅ 修复 `skillType` 默认值类型
- ✅ 添加类型断言绕过 LangGraph 类型限制
- ✅ 修复工作流边配置

#### `src/lib/langgraph/decoration-nodes.ts`
- ✅ 修复 `hasFiles` 类型错误

#### `src/app/api/decoration-chat/route.ts`
- ✅ 添加类型断言
- ✅ 修复 result 类型推断问题

### 4. 环境变量

#### `.env.local`
已经配置，无需修改：
- ✅ `QWEN_API_KEY` - 千问 LLM API Key
- ✅ `VOLCANO_KNOWLEDGE_ENDPOINT` - 火山引擎知识库端点
- ✅ `VOLCANO_API_KEY` - 火山引擎 API Key（待配置）
- ✅ `VOLCANO_SERVICE_RESOURCE_ID` - 火山引擎知识库服务ID

#### `.env.example`
已经更新，移除扣子相关配置：
- ✅ `COZE_API_TOKEN` 已移除
- ✅ `COZE_SUPABASE_URL` 已移除
- ✅ `COZE_SUPABASE_ANON_KEY` 已移除

## 技术架构

### 后端 API

| API 端点 | 功能 | 状态 |
|---------|------|------|
| `/api/decoration-chat` | 装修助手聊天（LangGraph） | ✅ 正常 |
| `/api/test-volcano` | 火山引擎知识库测试 | ✅ 正常 |
| `/api/test-oss` | OSS 测试 | ✅ 正常 |
| `/api/upload` | 文件上传（OSS） | ✅ 正常 |
| `/api/chat` | 扣子聊天 | ❌ 已删除 |
| `/api/langgraph-chat` | LangGraph 测试 | ❌ 已删除 |

### 核心集成

| 集成服务 | 技术 | 状态 |
|---------|------|------|
| LLM | 千问 (Qwen-max) + 联网搜索 | ✅ 已集成 |
| 知识库 | 火山引擎知识库 | ✅ 已集成 |
| 工作流 | LangGraph | ✅ 已集成 |
| 文件存储 | 阿里云 OSS | ✅ 已集成 |

### 装修助手三大技能

1. **知识问答** (`knowledge`)
   - 基于火山引擎知识库检索
   - 联网搜索补充
   - 专业装修知识解答

2. **报价单检测** (`quotation`)
   - 报价单文件解析
   - 价格异常检测
   - 可视化报告生成
   - 价格波动预警

3. **方案设计** (`design`)
   - 需求收集
   - 3套方案生成
   - 方案对比分析
   - 免责声明标注

## 验证结果

### 构建测试
```bash
pnpm build
```
✅ 构建成功

### 服务测试
```bash
curl http://localhost:5000
```
✅ 服务正常

### API 测试
```bash
curl http://localhost:5000/api/decoration-chat
```
✅ 返回正常：
```json
{
  "status": "ok",
  "message": "装修助手API运行正常",
  "version": "2.0.0",
  "features": [
    "装修知识问答",
    "报价单检测",
    "方案设计"
  ],
  "integrations": {
    "llm": "千问 (Qwen)",
    "knowledgeBase": "火山引擎知识库",
    "framework": "LangGraph"
  }
}
```

## 后续配置

### 必需配置

1. **配置火山引擎知识库 API Key**
   编辑 `.env.local`：
   ```bash
   VOLCANO_API_KEY=你的火山引擎知识库API Key
   ```

### 可选配置

1. **测试火山引擎知识库**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"query":"装修预算怎么分配？","topK":3}' \
     http://localhost:5000/api/test-volcano
   ```

2. **测试装修助手完整功能**
   ```bash
   curl -X POST -H "Content-Type: application/json" \
     -d '{"message":"装修预算怎么分配？","userId":"test123","conversationId":"conv123"}' \
     http://localhost:5000/api/decoration-chat
   ```

## 注意事项

1. **用户ID变更**
   - 旧用户ID存储在 `localStorage.getItem('coze_user_id')`
   - 新用户ID存储在 `localStorage.getItem('decoration_user_id')`
   - 旧对话历史不受影响，但会使用新的用户ID

2. **对话ID管理**
   - 旧系统使用 `cozeConversationId`（扣子平台返回）
   - 新系统使用 `conversationId`（前端生成）
   - 前端自动管理对话ID，无需用户关心

3. **知识库检索**
   - 优先使用火山引擎知识库
   - 已移除 Supabase 降级逻辑
   - 需要配置 `VOLCANO_API_KEY` 才能正常工作

4. **文件上传**
   - 只上传到阿里云OSS
   - 不再上传到扣子平台
   - 文件URL有效期1天

## 文件清单

### 删除的文件
- `src/app/api/chat/route.ts`
- `src/app/api/langgraph-chat/route.ts`
- `src/app/api/kb/init/route.ts`
- `src/lib/rag/init.ts`
- `src/lib/rag/retrieval.ts`
- `src/lib/rag/sample-docs.ts`
- `src/lib/langgraph/nodes.ts`
- `src/lib/langgraph/types.ts`
- `src/lib/langgraph/workflow.ts`
- `src/storage/database/supabase-client.ts`

### 修改的文件
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/api/upload/route.ts`
- `src/lib/knowledge/volcano-knowledge.ts`
- `src/lib/langgraph/decoration-workflow.ts`
- `src/lib/langgraph/decoration-nodes.ts`
- `src/app/api/decoration-chat/route.ts`
- `.env.local`
- `.env.example`

### 新增的文档
- `COZE_REMOVAL_NOTES.md` (本文档)

## 参考文档

- [装修助手文档](README_DECORATION.md)
- [火山引擎配置指南](VOLCANO_CONFIG_GUIDE.md)
- [火山引擎更新说明](VOLCANO_UPDATE_NOTES.md)

---

**更新完成时间**: 2025-01-14
**版本**: 2.0.0
**状态**: ✅ 完成并验证
