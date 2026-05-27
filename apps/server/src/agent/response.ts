import { getLLM } from '../llm/provider.js';
import { responsePrompt } from '../llm/prompts.js';
import type { AgentState } from './types.js';

export async function generateResponse(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = responsePrompt.pipe(llm);

  const context = [
    state.context ? `检索到的信息：\n${state.context}` : '',
    state.entities ? `提取的实体：${JSON.stringify(state.entities)}` : '',
    state.intent ? `用户意图：${state.intent}` : '',
  ].filter(Boolean).join('\n\n');

  const result = await chain.invoke({ context, message: state.message });
  return { response: result.content.toString() };
}
