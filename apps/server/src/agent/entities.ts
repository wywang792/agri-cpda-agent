import { entityExtractionPrompt } from '../llm/prompts.js';
import { getLLM, getLLMTimeoutMs, isLLMConfigured } from '../llm/provider.js';
import type { AgentState, ExtractedEntities } from './types.js';
import { extractEntitiesByRules, formatHistory } from './fallback.js';
import { withTimeout } from './timeout.js';

export async function extractEntities(state: AgentState): Promise<Partial<AgentState>> {
  console.log('[Agent] extractEntities:start');

  if (!isLLMConfigured()) {
    const entities = extractEntitiesByRules(state.message, state.history);
    console.log(`[Agent] extractEntities:fallback no api key -> ${entities.items.length} items`);
    return { entities };
  }

  try {
    const llm = getLLM();
    const chain = entityExtractionPrompt.pipe(llm);
    const result = await withTimeout(
      chain.invoke({ message: state.message, history: formatHistory(state.history) }),
      getLLMTimeoutMs(),
      'entity extraction'
    );
    const content = result.content.toString().trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { entities: extractEntitiesByRules(state.message, state.history) };
    }

    const entities: ExtractedEntities = JSON.parse(jsonMatch[0]);
    console.log(`[Agent] extractEntities:done -> ${entities.items.length} items`);
    return { entities };
  } catch (error: any) {
    const entities = extractEntitiesByRules(state.message, state.history);
    console.warn(`[Agent] extractEntities:fallback ${error.message} -> ${entities.items.length} items`);
    return { entities };
  }
}
