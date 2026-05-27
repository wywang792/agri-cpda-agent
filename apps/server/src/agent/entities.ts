import { getLLM } from '../llm/provider.js';
import { entityExtractionPrompt } from '../llm/prompts.js';
import type { AgentState, ExtractedEntities } from './types.js';

export async function extractEntities(state: AgentState): Promise<Partial<AgentState>> {
  const llm = getLLM();
  const chain = entityExtractionPrompt.pipe(llm);
  const result = await chain.invoke({ message: state.message });
  const content = result.content.toString().trim();

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { entities: null };
    const entities: ExtractedEntities = JSON.parse(jsonMatch[0]);
    return { entities };
  } catch {
    return { entities: null };
  }
}
