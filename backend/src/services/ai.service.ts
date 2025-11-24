import { prisma } from '../utils/prisma';
import conversationExampleService from './conversation-example.service';
import openaiService from './ai-providers/openai.service';
import anthropicService from './ai-providers/anthropic.service';
import { AIProvider } from '../types/ai-provider';

class AIService {
  /**
   * Obtém o provedor de IA configurado
   */
  private getProvider(providerName?: AIProvider) {
    // Usa o provedor especificado ou o padrão do .env
    const provider = providerName || (process.env.AI_PROVIDER as AIProvider) || 'openai';

    switch (provider) {
      case 'openai':
        return openaiService;
      case 'anthropic':
        return anthropicService;
      default:
        console.warn(`Unknown AI provider: ${provider}. Falling back to OpenAI.`);
        return openaiService;
    }
  }

  /**
   * Gera resposta automática usando o provedor configurado
   */
  async generateResponse(
    customerId: string,
    message: string,
    options?: { provider?: AIProvider; temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      // Busca o customer com informações da empresa
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          company: {
            include: {
              aiKnowledge: true,
            },
          },
        },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Busca as últimas 10 mensagens do histórico
      const messages = await prisma.message.findMany({
        where: { customerId },
        orderBy: { timestamp: 'desc' },
        take: 10,
        include: {
          customer: true,
        },
      });

      // Inverte para ordem cronológica (mais antiga primeiro)
      const messageHistory = messages.reverse();

      // Monta o contexto da empresa
      const aiKnowledge = customer.company.aiKnowledge;
      const companyInfo = aiKnowledge?.companyInfo || 'Informações da empresa não disponíveis.';
      const productsServices = aiKnowledge?.productsServices || 'Produtos/serviços não especificados.';
      const toneInstructions = aiKnowledge?.toneInstructions || 'Seja profissional, educado e prestativo.';
      const policies = aiKnowledge?.policies || 'Nenhuma política específica definida.';

      // Formata o histórico de mensagens de forma otimizada
      const historyText = messageHistory
        .map((msg) => {
          const sender = msg.direction === 'INBOUND' ? customer.name : 'Assistente';
          const senderTypeLabel = msg.senderType === 'AI' ? ' (IA)' : msg.senderType === 'HUMAN' ? ' (Humano)' : '';
          return `${sender}${senderTypeLabel}: ${msg.content}`;
        })
        .join('\n');

      // Busca exemplos de conversas exemplares (limitado para otimização)
      const examplesText = await conversationExampleService.getExamplesForPrompt(customer.companyId);

      // Monta o prompt otimizado para GPT-4o Mini
      // Prompt mais conciso e estruturado para economizar tokens
      const systemPrompt = this.buildOptimizedPrompt({
        companyName: customer.company.name,
        companyInfo,
        productsServices,
        toneInstructions,
        policies,
        examplesText,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerTags: customer.tags,
        customerNotes: customer.notes,
      });

      const userPrompt = this.buildUserPrompt(historyText, message);

      console.log(`[AIService] Generating response for customer: ${customer.name}`);

      // Seleciona e usa o provedor
      const provider = this.getProvider(options?.provider);

      if (!provider.isConfigured()) {
        throw new Error(`AI provider is not configured. Please check your environment variables.`);
      }

      const aiResponse = await provider.generateResponse({
        systemPrompt,
        userPrompt,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      console.log('[AIService] Response generated successfully');

      return aiResponse;
    } catch (error: any) {
      console.error('[AIService] Error generating AI response:', error);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  /**
   * Constrói prompt otimizado (mais conciso para GPT-4o Mini)
   */
  private buildOptimizedPrompt(data: {
    companyName: string;
    companyInfo: string;
    productsServices: string;
    toneInstructions: string;
    policies: string;
    examplesText: string;
    customerName: string;
    customerPhone: string;
    customerEmail?: string | null;
    customerTags: string[];
    customerNotes?: string | null;
  }): string {
    const {
      companyName,
      companyInfo,
      productsServices,
      toneInstructions,
      policies,
      examplesText,
      customerName,
      customerPhone,
      customerEmail,
      customerTags,
      customerNotes,
    } = data;

    // Prompt otimizado: mais direto e conciso
    return `Você é o assistente virtual da ${companyName}.

# EMPRESA
${companyInfo}

# PRODUTOS/SERVIÇOS
${productsServices}

# TOM
${toneInstructions}

# POLÍTICAS
${policies}

${examplesText ? `# EXEMPLOS DE REFERÊNCIA\n${examplesText}\n` : ''}# CLIENTE
Nome: ${customerName}
Telefone: ${customerPhone}${customerEmail ? `\nEmail: ${customerEmail}` : ''}${
      customerTags.length > 0 ? `\nTags: ${customerTags.join(', ')}` : ''
    }${customerNotes ? `\nNotas: ${customerNotes}` : ''}

# INSTRUÇÕES
- Responda de forma útil, personalizada e contextualizada
- Mantenha o tom da empresa
- Use o histórico para contexto
- Siga as políticas rigorosamente
- Seja proativo

Responda APENAS com a mensagem ao cliente (sem rótulos ou prefixos).`;
  }

  /**
   * Constrói prompt do usuário
   */
  private buildUserPrompt(historyText: string, currentMessage: string): string {
    return `${historyText ? `Histórico:\n${historyText}\n\n` : ''}Cliente: ${currentMessage}

Sua resposta:`;
  }

  /**
   * Verifica se algum provedor está configurado
   */
  isConfigured(): boolean {
    return openaiService.isConfigured() || anthropicService.isConfigured();
  }

  /**
   * Retorna informações sobre o provedor atual
   */
  getCurrentProviderInfo() {
    const providerName = (process.env.AI_PROVIDER as AIProvider) || 'openai';
    const provider = this.getProvider(providerName);
    return provider.getModelInfo();
  }

  /**
   * Lista todos os provedores disponíveis
   */
  getAvailableProviders() {
    return [
      {
        name: 'openai',
        configured: openaiService.isConfigured(),
        info: openaiService.getModelInfo(),
      },
      {
        name: 'anthropic',
        configured: anthropicService.isConfigured(),
        info: anthropicService.getModelInfo(),
      },
    ];
  }
}

export default new AIService();
