# 部署配置说明

## 零配置部署

本项目已配置为开箱即用，所有敏感配置已在代码中设置默认值。

## 配置清单

### 1. 豆包 LLM API
- **配置文件**: `src/lib/llm/doubao-client.ts`
- **默认值**:
  - API Key: `YOUR_API_KEY`
  - API Endpoint: `https://ark.cn-beijing.volces.com/api/v3/responses`
  - Model: `doubao-seed-2-0-pro-260215`
- **功能**: 提供聊天对话、思考能力、图像分析

### 2. 火山引擎知识库
- **配置文件**: `src/lib/knowledge/volcano-knowledge.ts`
- **默认值**:
  - Endpoint: `api-knowledgebase.mlp.cn-beijing.volces.com`
  - API Key: `YOUR_API_KEY`
  - Service Resource ID: `YOUR_SERVICE_RESOURCE_ID`
- **功能**: 提供装修知识检索

### 3. 阿里云 OSS
- **配置文件**: `src/app/api/upload/route.ts`
- **环境变量**:
  - `OSS_REGION`: Region（如 `oss-cn-beijing`）
  - `OSS_BUCKET`: Bucket名称（如 `ssy-decoration`）
  - `OSS_ACCESS_KEY_ID`: Access Key ID
  - `OSS_ACCESS_KEY_SECRET`: Access Key Secret
  - `OSS_ENDPOINT`: Endpoint（如 `oss-cn-beijing.aliyuncs.com`）
- **功能**: 文件存储（PDF、图片）

### 4. 扣子工作流
- **配置文件**: `src/lib/coze/workflow-client.ts`
- **环境变量**:
  - `COZE_API_TOKEN`: Coze API Token
  - `COZE_API_BASE`: API Base（如 `https://api.coze.cn`）
  - `COZE_WORKFLOW_ID`: Workflow ID
  - `COZE_BOT_ID`: Bot ID
- **功能**: 报价单检测工作流

### 5. AI Conductor API
- **配置文件**: `src/lib/utils/report-generator.ts`
- **默认值**:
  - API URL: `http://plugin.aiconductor.fun/api/html_publish`
- **功能**: 发布HTML报告

## 部署步骤

### 本地运行
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
# 或
coze dev
```

### 生产部署
```bash
# 构建项目
pnpm build

# 启动生产服务器
pnpm start
# 或
coze start
```

### 使用 Coze CLI（推荐）
```bash
# 开发环境
coze dev

# 构建和部署
coze build
coze start
```

## 功能验证

### 1. 装修知识问答
- 输入："客厅吊顶怎么做比较好？"
- 预期：返回装修知识解答，并附带知识库来源

### 2. 方案设计
- 输入："帮我设计一个北欧风格的客厅"
- 预期：返回详细的设计方案

### 3. 报价单检测
- 上传：装修报价单 PDF 文件
- 预期：返回报价分析和问题列表

### 4. 图片风格分析
- 上传：装修图片（JPG、PNG、WebP）
- 预期：返回风格识别、优缺点分析、预算估算

## 端口配置

- **开发环境**: `http://localhost:5000`
- **生产环境**: `http://localhost:5000`

## 注意事项

1. **默认端口**: 5000（通过 `.coze` 文件配置）
2. **文件大小限制**: 10MB
3. **支持文件类型**:
   - 文档：PDF、DOC、DOCX、XLS、XLSX
   - 图片：JPG、PNG、GIF、WebP
4. **超时配置**:
   - 前端：15分钟
   - 后端：14分钟（报价单检测）

## 环境变量（可选）

虽然所有配置都有默认值，但仍支持通过环境变量覆盖：

```bash
# 豆包 LLM
DOUBAO_API_KEY=your_key
DOUBAO_API_ENDPOINT=your_endpoint
DOUBAO_MODEL=your_model

# 火山引擎知识库
VOLCANO_KNOWLEDGE_ENDPOINT=your_endpoint
VOLCANO_API_KEY=your_key
VOLCANO_SERVICE_RESOURCE_ID=your_service_id

# 扣子工作流
COZE_API_TOKEN=your_token
COZE_API_BASE=your_base
COZE_WORKFLOW_ID=your_workflow_id
COZE_BOT_ID=your_bot_id
```

## 故障排查

### 1. 服务无法启动
```bash
# 检查端口占用
ss -tuln | grep 5000

# 检查依赖安装
pnpm install
```

### 2. 知识库检索失败
- 检查 `VOLCANO_API_KEY` 是否正确
- 检查 `VOLCANO_SERVICE_RESOURCE_ID` 是否正确

### 3. 图片上传失败
- 检查文件大小是否超过 10MB
- 检查文件类型是否支持

### 4. 报价单检测超时
- 正常情况可能需要 10-14 分钟
- 检查扣子工作流是否正常运行

## 技术栈

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4
- shadcn/ui
- 豆包 LLM
- 火山引擎知识库
- 阿里云 OSS
- 扣子工作流
- AI Conductor API
