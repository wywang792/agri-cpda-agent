import { StateGraph, END, START } from '@langchain/langgraph';
import { Annotation } from '@langchain/langgraph';
import type { AgentIntent, Order } from '@agent-xfd/shared';
import type { ExtractedEntities } from './types.js';
import { recognizeIntent } from './intent.js';
import { extractEntities } from './entities.js';
import { retrieveContext } from './retrieval.js';
import { generateResponse } from './response.js';

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
  suggestions: Annotation<string[]>,
  history: Annotation<Array<{ role: 'user' | 'assistant'; content: string }>>,
});

function routeByIntent(state: typeof AgentStateAnnotation.State): string {
  const intent = state.intent;
  if (intent === 'place_order' || intent === 'ask_price' || intent === 'recommend') {
    return 'extractEntities';
  }
  if (intent === 'query_order') {
    return 'retrieveContext';
  }
  return 'generateResponse';
}

export function buildAgentGraph() {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode('recognizeIntent', recognizeIntent)
    .addNode('extractEntities', extractEntities)
    .addNode('retrieveContext', retrieveContext)
    .addNode('generateResponse', generateResponse)
    .addEdge(START, 'recognizeIntent')
    .addConditionalEdges('recognizeIntent', routeByIntent, {
      extractEntities: 'extractEntities',
      retrieveContext: 'retrieveContext',
      generateResponse: 'generateResponse',
    })
    .addEdge('extractEntities', 'retrieveContext')
    .addEdge('retrieveContext', 'generateResponse')
    .addEdge('generateResponse', END);

  return graph.compile();
}
