// 装修助手 LangGraph 工作流
// 实现三大核心技能：知识问答、报价单检测、方案设计
// 所有任务都先进行知识库查询，然后基于检索结果回答

import { StateGraph, END } from '@langchain/langgraph';
import type { DecorationAssistantState, SkillType } from './decoration-types';
import {
  skillIdentificationNode,
  knowledgeSearchNode,
  knowledgeQA,
  quotationAnalysisNode,
  designProposalNode,
} from './decoration-nodes';

/**
 * 技能路由函数
 * 根据识别的技能类型路由到对应的处理节点
 * 返回条件名称（不是节点名称）
 */
function routeBySkill(state: DecorationAssistantState): string {
  console.log('[技能路由] 当前技能:', state.skillType);

  switch (state.skillType) {
    case 'knowledge':
      return 'knowledge';
    case 'quotation':
      return 'quotation';
    case 'design':
      return 'design';
    default:
      return 'knowledge'; // 默认路由到知识问答
  }
}

/**
 * 创建装修助手工作流
 */
export function createDecorationWorkflow() {
  console.log('[工作流构建] 开始构建装修助手 LangGraph 工作流');

  // 定义状态
  const workflow = new StateGraph<DecorationAssistantState>({
    channels: {
      // 所有状态属性
      userMessage: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      files: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      userId: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      conversationId: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      skillType: {
        value: (x: SkillType, y?: SkillType) => y ?? x,
        default: () => 'unknown' as SkillType,
      },
      knowledgeQuery: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      knowledgeAnswer: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      knowledgeContext: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      quotationFile: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      quotationReportUrl: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      quotationAnalysis: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      quotationAnalysisText: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      designRequirements: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      missingInfo: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      designProposals: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      designComparison: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      llmResponse: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      thinking: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      reasoning: {
        value: (x: string, y?: string) => y ?? x,
        default: () => '',
      },
      knowledgeResults: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      webSearchResults: {
        value: (x: any, y?: any) => y ?? x,
        default: () => undefined,
      },
      isStreaming: {
        value: (x: boolean, y?: boolean) => y ?? x,
        default: () => false,
      },
      responseChunks: {
        value: (x: any, y?: any) => y ?? x,
        default: () => [],
      },
      timestamp: {
        value: (x: number, y?: number) => y ?? x,
        default: () => Date.now(),
      },
      metadata: {
        value: (x: any, y?: any) => y ?? x,
        default: () => ({}),
      },
    },
  } as any); // 添加类型断言绕过类型检查

  // 添加节点
  workflow.addNode('skillIdentification', skillIdentificationNode);
  workflow.addNode('knowledgeSearch', knowledgeSearchNode); // 新增：知识库检索节点（所有任务都执行）
  workflow.addNode('knowledgeQANode', knowledgeQA);
  workflow.addNode('quotationAnalysisNode', quotationAnalysisNode);
  workflow.addNode('designProposalNode', designProposalNode);

  // 设置入口：从 __start__ 开始，执行 skillIdentification 节点
  workflow.addEdge('__start__', 'skillIdentification' as any);

  // 添加条件边：技能识别 → 知识库检索节点
  workflow.addConditionalEdges('skillIdentification' as any, routeBySkill, {
    knowledge: 'knowledgeSearch' as any,
    quotation: 'knowledgeSearch' as any,
    design: 'knowledgeSearch' as any,
    unknown: 'knowledgeSearch' as any,
  });

  // 知识库检索后，根据原技能类型路由到对应的处理节点
  workflow.addConditionalEdges('knowledgeSearch' as any, routeBySkill, {
    knowledge: 'knowledgeQANode' as any,
    quotation: 'quotationAnalysisNode' as any,
    design: 'designProposalNode' as any,
    unknown: 'knowledgeQANode' as any,
  });

  // 所有技能节点都直接结束
  workflow.addEdge('knowledgeQANode' as any, END);
  workflow.addEdge('quotationAnalysisNode' as any, END);
  workflow.addEdge('designProposalNode' as any, END);

  // 编译图
  const app = workflow.compile();

  console.log('[工作流构建] 装修助手 LangGraph 工作流构建完成（所有任务先执行知识库检索）');

  return app;
}

// 导出工作流实例
export const decorationWorkflow = createDecorationWorkflow();
