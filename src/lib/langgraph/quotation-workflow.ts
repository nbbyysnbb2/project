// 装修报价单检测 LangGraph 工作流
// 使用扣子工作流进行报价单检测

import { StateGraph, END } from '@langchain/langgraph';
import type { QuotationAnalysisState } from './quotation-types';
import {
  pdfParsingNode,
  knowledgeSearchNodeForQuotation,
  llmAnalysisNode,
  reportGenerationNode,
  htmlPublishNode,
  cozeWorkflowNode,
} from './quotation-nodes';

/**
 * 创建报价单检测工作流（使用扣子工作流）
 */
export function createQuotationWorkflow() {
  console.log('[报价单检测] 开始构建报价单检测 LangGraph 工作流');

  // 定义状态
  const workflow = new StateGraph<QuotationAnalysisState>({
    channels: {
      // 输入
      fileUrl: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      fileName: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // PDF解析
      pdfContent: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // 知识库检索
      knowledgeQuery: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      knowledgeResults: {
        value: (x: any, y?: any) => y ?? x,
        default: () => [],
      },
      knowledgeContext: {
        value: (x: any, y?: any) => y ?? x,
        default: () => '',
      },

      // LLM分析结果
      structuredOutput: {
        value: (x: any, y?: any) => y ?? x,
        default: () => ({
          file_source: '',
          proprietor: '',
          issues: [],
          issues_count: 0,
          high_severity_count: 0,
          overall_score: 0,
          risk_level: 'low' as const,
          summary: '',
        }),
      },

      // 报告生成
      htmlReport: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      reportUrl: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // 元数据
      timestamp: {
        value: (x: number, y?: number) => y ?? x,
        default: () => Date.now(),
      },
    },
  } as any);

  // 添加节点
  // 使用扣子工作流节点替代原有的多个节点
  workflow.addNode('cozeWorkflow', cozeWorkflowNode);

  // 设置入口节点
  workflow.setEntryPoint('cozeWorkflow' as any);

  // 扣子工作流完成后直接结束
  workflow.addEdge('cozeWorkflow' as any, END);

  // 编译图
  const app = workflow.compile();

  console.log('[报价单检测] 报价单检测 LangGraph 工作流构建完成');

  return app;
}

/**
 * 创建报价单检测工作流（使用本地节点）
 * 保留此函数用于调试或对比
 */
export function createQuotationWorkflowLegacy() {
  console.log('[报价单检测] 开始构建报价单检测 LangGraph 工作流（本地版本）');

  // 定义状态
  const workflow = new StateGraph<QuotationAnalysisState>({
    channels: {
      // 输入
      fileUrl: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      fileName: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // PDF解析
      pdfContent: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // 知识库检索
      knowledgeQuery: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      knowledgeResults: {
        value: (x: any, y?: any) => y ?? x,
        default: () => [],
      },
      knowledgeContext: {
        value: (x: any, y?: any) => y ?? x,
        default: () => '',
      },

      // LLM分析结果
      structuredOutput: {
        value: (x: any, y?: any) => y ?? x,
        default: () => ({
          file_source: '',
          proprietor: '',
          issues: [],
          issues_count: 0,
          high_severity_count: 0,
          overall_score: 0,
          risk_level: 'low' as const,
          summary: '',
        }),
      },

      // 报告生成
      htmlReport: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      reportUrl: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },

      // 元数据
      timestamp: {
        value: (x: number, y?: number) => y ?? x,
        default: () => Date.now(),
      },
    },
  } as any);

  // 添加节点
  workflow.addNode('pdfParsing', pdfParsingNode);
  workflow.addNode('knowledgeSearch', knowledgeSearchNodeForQuotation);
  workflow.addNode('llmAnalysis', llmAnalysisNode);
  workflow.addNode('reportGeneration', reportGenerationNode);
  workflow.addNode('htmlPublish', htmlPublishNode);

  // 设置入口节点
  workflow.setEntryPoint('pdfParsing' as any);

  // 设置工作流流程
  // 1. PDF解析 → 知识库检索
  workflow.addEdge('pdfParsing' as any, 'knowledgeSearch' as any);

  // 2. 知识库检索 → LLM分析
  workflow.addEdge('knowledgeSearch' as any, 'llmAnalysis' as any);

  // 3. LLM分析 → 报告生成
  workflow.addEdge('llmAnalysis' as any, 'reportGeneration' as any);

  // 4. 报告生成 → HTML发布
  workflow.addEdge('reportGeneration' as any, 'htmlPublish' as any);

  // 5. HTML发布 → 结束
  workflow.addEdge('htmlPublish' as any, END);

  // 编译图
  const app = workflow.compile();

  console.log('[报价单检测] 报价单检测 LangGraph 工作流构建完成（本地版本）');

  return app;
}

// 导出工作流实例
export const quotationWorkflow = createQuotationWorkflow();
