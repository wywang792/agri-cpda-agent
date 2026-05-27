import { getLLM } from '../llm/provider.js';
import { intentPrompt } from '../llm/prompts.js';
import type { AgentIntent } from '@agent-xfd/shared';
import type { AgentState } from './types.js';

export async function recognizeIntent(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = intentPrompt.pipe(llm);
  const result = await chain.invoke({ message: state.message });
  const intent = result.content.toString().trim().toLowerCase() as AgentIntent;

  const validIntents: AgentIntent[] = [
    'place_order', 'query_order', 'ask_price', 'confirm_order', 'cancel', 'recommend', 'chat'
  ];
  return { intent: validIntents.includes(intent) ? intent : 'chat' };
}
