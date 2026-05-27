import { responsePrompt } from '../llm/prompts.js';
import { getLLM, getLLMTimeoutMs, isLLMConfigured } from '../llm/provider.js';
import type { AgentState } from './types.js';
import { generateFallbackResponse } from './fallback.js';
import { withTimeout } from './timeout.js';

export async function generateResponse(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Agent] generateResponse:start');

  const context = [
    state.context ? `检索到的信息：\n${state.context}` : '',
    state.entities ? `提取的实体：${JSON.stringify(state.entities)}` : '',
    state.intent ? `用户意图：${state.intent}` : '',
  ].filter(Boolean).join('\n\n');

  if (!isLLMConfigured()) {
    const response = generateFallbackResponse({ intent: state.intent, message: state.message, context: state.context });
    console.log('[Agent] generateResponse:fallback no api key');
    return { response };
  }

  try {
    const llm = getLLM();
    const chain = responsePrompt.pipe(llm);
    const result = await withTimeout(
      chain.invoke({ context, message: state.message }),
      getLLMTimeoutMs(),
      'response generation'
    );
    console.log('[Agent] generateResponse:done');
    return { response: result.content.toString() };
  } catch (error: any) {
    console.warn(`[Agent] generateResponse:fallback ${error.message}`);
    return {
      response: generateFallbackResponse({ intent: state.intent, message: state.message, context: state.context }),
    };
  }
}
