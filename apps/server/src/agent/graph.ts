import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { OrderDraft } from '../modules/chat/types.js';
import type { ExtractedEntities } from './types.js';
import { recognizeIntent } from './intent.js';
import { extractEntities } from './entities.js';
import { retrieveContext } from './retrieval.js';
import { applyOrderFlow } from './orderDraft.js';
import { generateResponse } from './response.js';
import { manageAddressBook } from './addressBook.js';

const AgentStateAnnotation = Annotation.Root({
  message: Annotation<string>,
  userId: Annotation<string>,
  userRole: Annotation<'buyer' | 'supplier'>,
  marketId: Annotation<string>,
  conversationId: Annotation<string | undefined>,
  intent: Annotation<AgentIntent | null>,
  entities: Annotation<ExtractedEntities | null>,
  context: Annotation<string>,
  response: Annotation<string>,
  orderPreview: Annotation<Order | null>,
  orderDraft: Annotation<OrderDraft | null>,
  createdOrder: Annotation<Order | null>,
  missingFields: Annotation<string[]>,
  suggestions: Annotation<string[]>,
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>,
});

function routeByIntent(state: typeof AgentStateAnnotation.State): string {
  const intent = state.intent;
  if (intent === 'place_order' || intent === 'confirm_order' || intent === 'ask_price' || intent === 'recommend' || intent === 'manage_address') {
    return 'extractEntities';
  }
  if (intent === 'query_order') {
    return 'extractEntities';
  }
  return 'generateResponse';
}

function routeAfterExtraction(state: typeof AgentStateAnnotation.State): string {
  if (state.intent === 'manage_address') {
    return 'manageAddressBook';
  }
  return 'retrieveContext';
}

export function buildAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('recognizeIntent', recognizeIntent)
    .addNode('extractEntities', extractEntities)
    .addNode('manageAddressBook', manageAddressBook)
    .addNode('retrieveContext', retrieveContext)
    .addNode('applyOrderFlow', applyOrderFlow)
    .addNode('generateResponse', generateResponse)
    .addEdge(START, 'recognizeIntent')
    .addConditionalEdges('recognizeIntent', routeByIntent, {
      extractEntities: 'extractEntities',
      retrieveContext: 'retrieveContext',
      generateResponse: 'generateResponse',
    })
    .addConditionalEdges('extractEntities', routeAfterExtraction, {
      manageAddressBook: 'manageAddressBook',
      retrieveContext: 'retrieveContext',
    })
    .addEdge('manageAddressBook', END)
    .addEdge('retrieveContext', 'applyOrderFlow')
    .addEdge('applyOrderFlow', 'generateResponse')
    .addEdge('generateResponse', END);

  return graph.compile();
}
