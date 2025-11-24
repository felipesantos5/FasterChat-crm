import Anthropic from '@anthropic-ai/sdk';

interface GenerateResponseParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

class AnthropicService {
  private client: Anthropic;
  private model: string;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('ANTHROPIC_API_KEY not found in environment variables. Anthropic features will be disabled.');
    }
    this.client = new Anthropic({
      apiKey: apiKey || '',
    });
    this.model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';
  }

  /**
   * Gera resposta usando Claude
   */
  async generateResponse(params: GenerateResponseParams): Promise<string> {
    try {
      const {
        systemPrompt,
        userPrompt,
        temperature = 0.7,
        maxTokens = 1024,
      } = params;

      console.log(`[Anthropic] Generating response with ${this.model}`);

      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          {
            role: 'user',
            content: systemPrompt + '\n\n' + userPrompt,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude API');
      }

      console.log(`[Anthropic] Response generated successfully`);

      return content.text;
    } catch (error: any) {
      console.error('[Anthropic] Error generating response:', error);
      throw new Error(`Failed to generate Anthropic response: ${error.message}`);
    }
  }

  /**
   * Verifica se a API da Anthropic está configurada
   */
  isConfigured(): boolean {
    return !!process.env.ANTHROPIC_API_KEY;
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo() {
    return {
      provider: 'Anthropic',
      model: this.model,
      maxTokens: 200000, // Claude context window
      pricing: {
        input: '$3.00 / 1M tokens',
        output: '$15.00 / 1M tokens',
      },
      features: [
        'Respostas muito inteligentes',
        'Ótimo para contextos complexos',
        'Melhor raciocínio',
        'Ideal para casos difíceis',
      ],
    };
  }
}

export default new AnthropicService();
