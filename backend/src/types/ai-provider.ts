export type AIProvider = 'openai';

export interface AIProviderService {
  generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;
  isConfigured(): boolean;
  getModelInfo(): {
    provider: string;
    model: string;
    maxTokens: number;
    pricing: {
      input: string;
      output: string;
    };
    features: string[];
  };
}

export interface GenerateResponseOptions {
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
}
