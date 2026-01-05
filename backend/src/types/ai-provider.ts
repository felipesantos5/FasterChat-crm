export type AIProvider = 'openai' | 'gemini';

export interface AIProviderService {
  generateResponse(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature?: number;
    maxTokens?: number;
    imageBase64?: string;
    imageMimeType?: string;
    audioBase64?: string;
    audioMimeType?: string;
    enableTools?: boolean;
    context?: {
      customerId: string;
      companyId: string;
    };
  }): Promise<string>;
  isConfigured(): boolean;
  transcribeAudio?(audioInput: string, mimeType?: string): Promise<string>;
  analyzeImage?(imageInput: string, mimeType?: string, prompt?: string): Promise<string>;
  getModelInfo(): {
    provider: string;
    model: string;
    maxTokens: number;
    pricing: {
      input: string;
      output: string;
      audio?: string;
      vision?: string;
    };
    features: string[];
  };
}

export interface GenerateResponseOptions {
  provider?: AIProvider;
  temperature?: number;
  maxTokens?: number;
  enableTools?: boolean;
}
