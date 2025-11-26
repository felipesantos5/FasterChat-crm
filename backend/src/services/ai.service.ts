import { prisma } from "../utils/prisma";
import conversationExampleService from "./conversation-example.service";
import openaiService from "./ai-providers/openai.service";
import anthropicService from "./ai-providers/anthropic.service";
import { AIProvider } from "../types/ai-provider";

class AIService {
  /**
   * Obtém o provedor de IA configurado
   */
  private getProvider(providerName?: AIProvider) {
    // Usa o provedor especificado ou o padrão do .env
    const provider = providerName || (process.env.AI_PROVIDER as AIProvider) || "openai";

    switch (provider) {
      case "openai":
        return openaiService;
      case "anthropic":
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
        throw new Error("Customer not found");
      }

      // Busca as últimas 10 mensagens do histórico
      const messages = await prisma.message.findMany({
        where: { customerId },
        orderBy: { timestamp: "desc" },
        take: 10,
        include: {
          customer: true,
        },
      });

      // Inverte para ordem cronológica (mais antiga primeiro)
      const messageHistory = messages.reverse();

      // Monta o contexto da empresa
      const aiKnowledge = customer.company.aiKnowledge;

      // Verifica se resposta automática está habilitada
      if (aiKnowledge && !aiKnowledge.autoReplyEnabled) {
        throw new Error("Auto-reply is disabled for this company");
      }

      const companyInfo = aiKnowledge?.companyInfo || "Informações da empresa não disponíveis.";
      const productsServices = aiKnowledge?.productsServices || "Produtos/serviços não especificados.";
      const toneInstructions = aiKnowledge?.toneInstructions || "Seja profissional, educado e prestativo.";
      const policies = aiKnowledge?.policies || "Nenhuma política específica definida.";

      // Pega configurações avançadas da IA
      const providerConfig = aiKnowledge?.provider as AIProvider | undefined;
      const temperature = options?.temperature ?? aiKnowledge?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? aiKnowledge?.maxTokens ?? 500;

      // Formata o histórico de mensagens de forma otimizada
      const historyText = messageHistory
        .map((msg) => {
          const sender = msg.direction === "INBOUND" ? customer.name : "Assistente";
          const senderTypeLabel = msg.senderType === "AI" ? " (IA)" : msg.senderType === "HUMAN" ? " (Humano)" : "";
          return `${sender}${senderTypeLabel}: ${msg.content}`;
        })
        .join("\n");

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

      // Seleciona e usa o provedor (prioriza configuração da empresa)
      const provider = this.getProvider(options?.provider || providerConfig);

      if (!provider.isConfigured()) {
        throw new Error(`AI provider is not configured. Please check your environment variables.`);
      }

      const aiResponse = await provider.generateResponse({
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
      });

      return aiResponse;
    } catch (error: any) {
      console.error("AI Error:", error.message);
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

    // Prompt otimizado para naturalidade e contexto
    return `Você é o assistente virtual da ${companyName}.

# EMPRESA
${companyInfo}

# PRODUTOS/SERVIÇOS
${productsServices}

# TOM DE VOZ
${toneInstructions}

# POLÍTICAS
${policies}

${examplesText ? `# EXEMPLOS DE REFERÊNCIA\n${examplesText}\n` : ""}# CLIENTE
Nome: ${customerName}
Telefone: ${customerPhone}${customerEmail ? `\nEmail: ${customerEmail}` : ""}${customerTags.length > 0 ? `\nTags: ${customerTags.join(", ")}` : ""}${
      customerNotes ? `\nNotas: ${customerNotes}` : ""
    }

# REGRAS DE OURO (SIGA RIGOROSAMENTE)
1. **CONTINUIDADE:** Analise o histórico de mensagens abaixo. Se o cliente já estiver conversando (histórico recente), NÃO use saudações iniciais como "Oi", "Olá" ou "Tudo bem". Vá direto ao ponto da pergunta atual.
2. **SAUDAÇÃO:** Use "Oi" ou "Olá" APENAS se for a PRIMEIRA mensagem do histórico ou se o cliente disser "Oi" primeiro.
3. **NOME:** Evite repetir o nome do cliente em toda frase. Use o nome apenas na saudação inicial (se houver). Se o nome parecer uma empresa (ex: "Barbearia..."), não o use.
4. **FORMATO:** Escreva mensagens curtas, como num chat de WhatsApp. Evite blocos enormes de texto. Use emojis moderadamente se o tom permitir.
5. **CONTEXTO:** Use as informações anteriores do histórico para não perguntar o que o cliente já disse.

Responda APENAS com a mensagem ao cliente.`;
  }

  /**
   * Constrói prompt do usuário
   */
  private buildUserPrompt(historyText: string, currentMessage: string): string {
    // Adiciona data/hora atual para noção temporal
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    return `DATA/HORA ATUAL: ${now}

# HISTÓRICO DA CONVERSA (Mensagens Anteriores)
${historyText ? historyText : "(Início da conversa)"}

# MENSAGEM ATUAL DO CLIENTE
${currentMessage}

Sua resposta (lembre-se: sem 'Oi' repetitivo se já houver histórico):`;
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
    const providerName = (process.env.AI_PROVIDER as AIProvider) || "openai";
    const provider = this.getProvider(providerName);
    return provider.getModelInfo();
  }

  /**
   * Lista todos os provedores disponíveis
   */
  getAvailableProviders() {
    return [
      {
        name: "openai",
        configured: openaiService.isConfigured(),
        info: openaiService.getModelInfo(),
      },
      {
        name: "anthropic",
        configured: anthropicService.isConfigured(),
        info: anthropicService.getModelInfo(),
      },
    ];
  }
}

export default new AIService();
