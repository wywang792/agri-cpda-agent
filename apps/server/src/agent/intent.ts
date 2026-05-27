import { intentPrompt } from '../llm/prompts.js';
import { getLLM, getLLMTimeoutMs, isLLMConfigured } from '../llm/provider.js';
import type { AgentIntent } from '@agent-xfd/shared';
import type { AgentState } from './types.js';
import { recognizeIntentByRules } from './fallback.js';
import { withTimeout } from './timeout.js';

export async function recognizeIntent(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Agent] recognizeIntent:start');

  if (!isLLMConfigured()) {
    const intent = recognizeIntentByRules(state.message);
    console.log(`[Agent] recognizeIntent:fallback no api key -> ${intent}`);
    return { intent };
  }

  try {
    const llm = getLLM();
    const chain = intentPrompt.pipe(llm);
    const result = await withTimeout(
      chain.invoke({ message: state.message }),
      getLLMTimeoutMs(),
      'intent recognition'
    );
    const intent = result.content.toString().trim().toLowerCase() as AgentIntent;
    const validIntents: AgentIntent[] = [
      'place_order', 'query_order', 'ask_price', 'confirm_order', 'cancel', 'recommend', 'chat'
    ];
    const validated = validIntents.includes(intent) ? intent : recognizeIntentByRules(state.message);
    console.log(`[Agent] recognizeIntent:done -> ${validated}`);
    return { intent: validated };
  } catch (error: any) {
    const intent = recognizeIntentByRules(state.message);
    console.warn(`[Agent] recognizeIntent:fallback ${error.message} -> ${intent}`);
    return { intent };
  }
}
