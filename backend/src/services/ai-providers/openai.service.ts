import OpenAI from 'openai';

interface GenerateResponseParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not found in environment variables. OpenAI features will be disabled.');
    }
    this.client = new OpenAI({
      apiKey: apiKey || '',
    });
    this.model = process.env.OPENAI_MODEL_MINI || 'gpt-4o-mini';
  }

  /**
   * Gera resposta usando GPT-4o Mini com otimizações
   */
  async generateResponse(params: GenerateResponseParams): Promise<string> {
    try {
      const {
        systemPrompt,
        userPrompt,
        temperature = 0.7,
        maxTokens = 500, // GPT-4o Mini é mais eficiente com respostas concisas
        model,
      } = params;

      const modelToUse = model || this.model;

      console.log(`[OpenAI] Generating response with ${modelToUse}`);

      // Otimizações para GPT-4o Mini:
      // 1. Temperature mais baixa (0.7) para respostas mais consistentes
      // 2. Max tokens reduzido para economia
      // 3. Prompt mais estruturado
      const response = await this.client.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: 0.95, // Foca nas respostas mais prováveis
        frequency_penalty: 0.3, // Reduz repetições
        presence_penalty: 0.3, // Incentiva novos tópicos quando relevante
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No content in OpenAI response');
      }

      console.log(`[OpenAI] Response generated successfully. Tokens used: ${response.usage?.total_tokens || 'unknown'}`);

      // Log de custo aproximado (GPT-4o Mini é ~$0.15/1M input tokens, ~$0.60/1M output tokens)
      if (response.usage) {
        const inputCost = (response.usage.prompt_tokens / 1_000_000) * 0.15;
        const outputCost = (response.usage.completion_tokens / 1_000_000) * 0.60;
        const totalCost = inputCost + outputCost;
        console.log(`[OpenAI] Estimated cost: $${totalCost.toFixed(6)}`);
      }

      return content;
    } catch (error: any) {
      console.error('[OpenAI] Error generating response:', error);

      // Tratamento de erros específicos da OpenAI
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your billing.');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key.');
      } else if (error.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
      }

      throw new Error(`Failed to generate OpenAI response: ${error.message}`);
    }
  }

  /**
   * Verifica se a API da OpenAI está configurada
   */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Testa a conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 5,
      });
      return true;
    } catch (error) {
      console.error('[OpenAI] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo() {
    return {
      provider: 'OpenAI',
      model: this.model,
      maxTokens: 16384, // GPT-4o Mini context window
      pricing: {
        input: '$0.15 / 1M tokens',
        output: '$0.60 / 1M tokens',
      },
      features: [
        'Rápido e econômico',
        'Ideal para atendimento em escala',
        'Baixa latência',
        'Boa qualidade para conversas simples',
      ],
    };
  }
}

export default new OpenAIService();
