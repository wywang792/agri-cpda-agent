import { intentPrompt } from '../llm/prompts.js';
import { getLLM, getLLMTimeoutMs, isLLMConfigured } from '../llm/provider.js';
import type { AgentIntent } from '@agent-xfd/shared';
import type { AgentState } from './types.js';
import { formatHistory, recognizeIntentByRules } from './fallback.js';
import { withTimeout } from './timeout.js';

export async function recognizeIntent(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Agent] recognizeIntent:start');

  const ruleIntent = recognizeIntentByRules(state.message, state.history);
  if (ruleIntent !== 'chat') {
    console.log(`[Agent] recognizeIntent:rules -> ${ruleIntent}`);
    return { intent: ruleIntent };
  }

  if (!isLLMConfigured()) {
    console.log(`[Agent] recognizeIntent:fallback no api key -> ${ruleIntent}`);
    return { intent: ruleIntent };
  }

  try {
    const llm = getLLM();
    const chain = intentPrompt.pipe(llm);
    const result = await withTimeout(
        chain.invoke({ message: state.message, history: formatHistory(state.history) }),
      getLLMTimeoutMs(),
      'intent recognition'
    );
    const intent = result.content.toString().trim().toLowerCase() as AgentIntent;
    const validIntents: AgentIntent[] = [
      'place_order', 'query_order', 'ask_price', 'confirm_order', 'cancel', 'recommend', 'manage_address', 'chat'
    ];
    const validated = validIntents.includes(intent) ? intent : recognizeIntentByRules(state.message, state.history);
    console.log(`[Agent] recognizeIntent:done -> ${validated}`);
    return { intent: validated };
  } catch (error: any) {
    const intent = recognizeIntentByRules(state.message, state.history);
    console.warn(`[Agent] recognizeIntent:fallback ${error.message} -> ${intent}`);
    return { intent };
  }
}
