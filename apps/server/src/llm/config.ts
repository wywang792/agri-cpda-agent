export interface LLMConfig {
  provider: 'deepseek' | 'openai';
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  maxTokens: number;
}

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'deepseek') as LLMConfig['provider'];
  if (provider === 'deepseek') {
    return {
      provider: 'deepseek',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      temperature: Number(process.env.LLM_TEMPERATURE) || 0.3,
      maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
    };
  }
  return {
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    temperature: Number(process.env.LLM_TEMPERATURE) || 0.3,
    maxTokens: Number(process.env.LLM_MAX_TOKENS) || 2048,
  };
}
