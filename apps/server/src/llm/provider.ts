import { ChatOpenAI } from '@langchain/openai';
import { getLLMConfig } from './config.js';

let llmInstance: ChatOpenAI | null = null;

export function getLLM(): ChatOpenAI {
  if (llmInstance) return llmInstance;
  const config = getLLMConfig();
  llmInstance = new ChatOpenAI({
    modelName: config.model,
    openAIApiKey: config.apiKey,
    configuration: { baseURL: config.baseUrl },
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  return llmInstance;
}

export function resetLLM(): void {
  llmInstance = null;
}
