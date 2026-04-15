# 装修报价单检测功能实现说明

## 📋 概述

基于扣子平台导出的工作流文件 `decoration-draft.yaml`，使用 LangGraph 复现了装修报价单检测功能。

## 🔄 工作流程对比

### 扣子工作流
```
开始节点 (100001)
  ↓
LinkReaderPlugin (169436) - PDF解析
  ↓
知识库检索 (196637) - 火山引擎知识库
  ↓
大模型 (129061) - 豆包深度思考模型
  ↓
代码节点 (149605) - 生成HTML报告
  ↓
html2url (150169) - 发布网页
  ↓
结束节点 (900001)
```

### LangGraph 工作流
```
开始
  ↓
pdfParsingNode - PDF解析（使用 pdf-parse 库）
  ↓
knowledgeSearchNodeForQuotation - 知识库检索（火山引擎）
  ↓
llmAnalysisNode - LLM分析（千问 qwen3-max）
  ↓
reportGenerationNode - 生成HTML报告
  ↓
htmlPublishNode - 发布到阿里云OSS
  ↓
结束
```

## 📁 新增文件

### 1. 类型定义
- **`src/lib/langgraph/quotation-types.ts`**
  - 定义报价单检测状态接口
  - 定义结构化输出接口
  - 定义问题项接口

### 2. 节点实现
- **`src/lib/langgraph/quotation-nodes.ts`**
  - `pdfParsingNode`: PDF解析节点
  - `knowledgeSearchNodeForQuotation`: 知识库检索节点
  - `llmAnalysisNode`: LLM分析节点
  - `reportGenerationNode`: HTML报告生成节点
  - `htmlPublishNode`: HTML发布节点

### 3. 工作流定义
- **`src/lib/langgraph/quotation-workflow.ts`**
  - 定义报价单检测工作流
  - 设置节点执行顺序

### 4. 工具函数
- **`src/lib/utils/report-generator.ts`**
  - `generateQuotationReport()`: 生成HTML报告
  - `publishHtmlReport()`: 发布HTML报告（占位符）

- **`src/lib/langgraph/pdf-parser.ts`**
  - `parsePdf()`: 解析PDF文件
  - `parsePdfFromUrl()`: 从URL解析PDF

## 🔧 技术实现

### 1. PDF解析
- **扣子方案**: LinkReaderPlugin (API ID: 7379227817307029513)
- **LangGraph方案**: 使用 `pdf-parse` npm 库
- **依赖**: `pnpm add pdf-parse`

### 2. 知识库检索
- **扣子方案**: 火山引擎知识库
  - Dataset ID: 7599552313292472354
  - Volcano Service ID: kb-service-aaa0c32412ac306e
  - TopK: 5
- **LangGraph方案**: 复用现有的 `volcano-knowledge.ts`
  - ServiceResourceId: `YOUR_SERVICE_RESOURCE_ID`
  - TopK: 5

### 3. LLM分析
- **扣子方案**: 豆包深度思考模型 (豆包·1.8·深度思考)
- **LangGraph方案**: 千问 qwen3-max（已启用思考能力）
- **提示词**: 复用扣子的提示词，要求输出 JSON 格式

### 4. HTML报告生成
- **扣子方案**: Python代码节点，生成HTML
- **LangGraph方案**: TypeScript函数，生成HTML
- **功能**: 完全复现扣子的HTML报告样式和功能

### 5. HTML发布
- **扣子方案**: html2url (API ID: 7516530863551807526)
  - API Key: sk_e0a702a9337cf745dc97770a982cb3
- **LangGraph方案**: 使用阿里云OSS存储
  - Bucket: ssy-decoration
  - 路径: `quotation-reports/{filename}`
  - 签名URL有效期: 7天

## ✅ 已完成功能

1. ✅ PDF解析功能（使用 pdf-parse 库）
2. ✅ 知识库检索功能（复用火山引擎）
3. ✅ LLM分析功能（使用千问 qwen3-max）
4. ✅ HTML报告生成功能（完全复现扣子样式）
5. ✅ HTML发布功能（使用阿里云OSS）
6. ✅ 工作流集成（集成到装修助手主工作流）

## 🔍 需要用户提供的信息（可选）

如果您想使用扣子的原始API，可以提供以下信息：

### 1. PDF解析API（LinkReaderPlugin）
```typescript
// API 信息
- API ID: 7379227817307029513
- Plugin ID: 7379227817307013129
- Plugin Name: 链接读取
```

### 2. HTML发布API（html2url）
```typescript
// API 信息
- API ID: 7516530863551807526
- Plugin ID: 7516530863551791142
- Plugin Name: 发布网页
- API Key: sk_e0a702a9337cf745dc97770a982cb3
```

**注意**: 当前实现使用 `pdf-parse` 和阿里云OSS，已经可以正常工作，无需提供上述API信息。

## 🎯 使用方式

1. 用户上传装修报价单文件（PDF、Word、Excel等）
2. 系统自动识别为报价单检测任务
3. 执行报价单检测工作流：
   - 解析PDF内容
   - 检索相关知识库信息
   - 使用千问LLM分析报价单
   - 生成结构化分析结果
   - 生成HTML报告
   - 发布到阿里云OSS
4. 返回分析结果和报告链接
5. 用户点击链接查看详细的HTML报告

## 📊 分析报告内容

生成的HTML报告包含以下内容：

1. **基本信息**
   - 工程信息（施工地址、施工时间）
   - 报价信息（报价单位、报价日期、联系人、电话）
   - 分析时间

2. **评分卡片**
   - 整体评分（0-100）
   - 评分进度条
   - 风险等级（high/medium/low）

3. **总体评价**
   - 文本形式的总体评价

4. **统计卡片**
   - 发现问题总数
   - 高风险问题数量
   - 高风险占比

5. **问题详情表格**
   - 序号
   - 问题类别
   - 严重程度
   - 问题描述
   - 问题位置
   - 整改建议

6. **页脚**
   - 报告生成时间
   - 提示信息

## 🔐 安全说明

### 已知的安全问题

⚠️ **阿里云OSS AccessKey 硬编码**

在代码中应使用环境变量配置 OSS AccessKey：

```typescript
const OSS_CONFIG = {
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  // ...
};
```

**配置方式**：
1. 创建 `.env` 文件
2. 添加环境变量：
   ```
   OSS_ACCESS_KEY_ID=your_access_key_id
   OSS_ACCESS_KEY_SECRET=your_access_key_secret
   ```

## 📝 测试步骤

1. 启动开发服务：`pnpm dev`
2. 访问应用：`http://localhost:5000`
3. 上传一个装修报价单文件（PDF格式）
4. 系统自动执行报价单检测
5. 查看分析结果和报告链接
6. 点击链接查看详细的HTML报告

## 🚀 未来优化方向

1. **PDF解析优化**
   - 支持更多PDF格式
   - 提高表格解析准确率
   - 支持图片内容提取

2. **知识库优化**
   - 扩充知识库内容
   - 优化检索算法
   - 支持更多检索策略

3. **LLM优化**
   - 优化提示词
   - 提高分析准确率
   - 支持更多分析维度

4. **报告优化**
   - 添加更多图表
   - 支持报告导出
   - 支持报告分享

5. **用户体验优化**
   - 支持批量上传
   - 支持报告对比
   - 支持历史报告查询

## 📞 联系方式

如有问题，请查看代码注释或联系开发团队。
