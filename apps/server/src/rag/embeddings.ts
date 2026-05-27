import { OpenAIEmbeddings } from '@langchain/openai';
import { getLLMConfig } from '../llm/config.js';

let embeddingsInstance: OpenAIEmbeddings | null = null;

export function getEmbeddings(): OpenAIEmbeddings {
  if (embeddingsInstance) return embeddingsInstance;
  const config = getLLMConfig();
  embeddingsInstance = new OpenAIEmbeddings({
    modelName: 'text-embedding-v3',
    openAIApiKey: config.apiKey,
    configuration: { baseURL: config.baseUrl },
  });
  return embeddingsInstance;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return getEmbeddings().embedQuery(text);
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return getEmbeddings().embedDocuments(texts);
}
