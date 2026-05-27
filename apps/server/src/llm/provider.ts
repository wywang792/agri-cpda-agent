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
    maxRetries: 0,
    timeout: config.timeoutMs,
  });
  return llmInstance;
}

export function isLLMConfigured(): boolean {
  return Boolean(getLLMConfig().apiKey);
}

export function getLLMTimeoutMs(): number {
  return getLLMConfig().timeoutMs;
}

export function resetLLM(): void {
  llmInstance = null;
}
