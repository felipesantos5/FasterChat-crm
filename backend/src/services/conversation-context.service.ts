import { prisma } from "../utils/prisma";

/**
 * ============================================
 * CONVERSATION CONTEXT SERVICE
 * ============================================
 * Serviço responsável por analisar o contexto da conversa
 * e detectar qual serviço/combo o cliente está interessado.
 *
 * Isso permite que quando o cliente pede para agendar,
 * a IA já saiba qual serviço ele quer sem precisar perguntar novamente.
 */

interface ServiceContext {
  serviceId: string;
  serviceName: string;
  servicePrice: string;
  serviceDuration?: number;
  confidence: number; // 0-1, quanto maior mais certeza
  detectedFrom: "explicit_mention" | "price_question" | "details_question" | "comparison";
}

interface ConversationContextResult {
  detectedService: ServiceContext | null;
  recentTopics: string[];
  customerIntent: "scheduling" | "information" | "pricing" | "comparison" | "unknown";
}

class ConversationContextService {
  /**
   * Analisa o histórico recente da conversa para detectar contexto
   * @param customerId ID do cliente
   * @param companyId ID da empresa
   * @param currentMessage Mensagem atual (para verificar intenção)
   * @returns Contexto detectado com serviço de interesse
   */
  async analyzeConversationContext(
    customerId: string,
    companyId: string,
    currentMessage: string
  ): Promise<ConversationContextResult> {
    // Busca últimas 10 mensagens da conversa
    const recentMessages = await prisma.message.findMany({
      where: { customerId },
      orderBy: { timestamp: "desc" },
      take: 10,
      select: {
        content: true,
        direction: true,
        senderType: true,
        timestamp: true,
      },
    });

    // Busca serviços/combos disponíveis da empresa
    const services = await prisma.service.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        basePrice: true,
        duration: true,
        description: true,
        category: true,
      },
    });

    // Inverte para ordem cronológica
    const chronologicalMessages = recentMessages.reverse();

    // Detecta o serviço mais provável baseado no contexto
    const detectedService = this.detectServiceFromHistory(
      chronologicalMessages,
      services,
      currentMessage
    );

    // Detecta a intenção do cliente na mensagem atual
    const customerIntent = this.detectCustomerIntent(currentMessage);

    // Extrai tópicos recentes da conversa
    const recentTopics = this.extractRecentTopics(chronologicalMessages, services);

    return {
      detectedService,
      recentTopics,
      customerIntent,
    };
  }

  /**
   * Detecta qual serviço está sendo discutido no histórico
   */
  private detectServiceFromHistory(
    messages: Array<{ content: string; direction: string; senderType: string | null }>,
    services: Array<{ id: string; name: string; basePrice: number; duration: number | null; description: string | null; category: string | null }>,
    currentMessage: string
  ): ServiceContext | null {
    if (services.length === 0) return null;

    // Pontuação para cada serviço baseado em menções
    const serviceScores: Map<string, { score: number; detectedFrom: ServiceContext["detectedFrom"] }> = new Map();

    // Palavras-chave que indicam interesse em um serviço
    const interestKeywords = [
      "quanto custa",
      "qual o preço",
      "qual o valor",
      "preço",
      "valor",
      "como funciona",
      "o que inclui",
      "detalhes",
      "mais informações",
      "me fala mais",
      "quero saber",
      "interessado",
      "gostaria",
      "preciso",
      "quero",
      "vou querer",
      "pode ser",
      "esse mesmo",
      "é esse",
      "quero esse",
      "vou fazer",
      "vou agendar",
      "marca",
      "agenda",
    ];

    // Analisa cada mensagem do histórico (mais recentes têm mais peso)
    messages.forEach((msg, index) => {
      const content = msg.content.toLowerCase();
      const isFromCustomer = msg.direction === "INBOUND";
      const recencyWeight = (index + 1) / messages.length; // Mensagens mais recentes têm mais peso

      services.forEach((service) => {
        const serviceLower = service.name.toLowerCase();
        const categoryLower = service.category?.toLowerCase() || "";

        // Palavras do nome do serviço (para match parcial)
        const serviceWords = serviceLower.split(/\s+/).filter(w => w.length > 3);

        let matchScore = 0;
        let detectedFrom: ServiceContext["detectedFrom"] = "explicit_mention";

        // Match exato do nome do serviço
        if (content.includes(serviceLower)) {
          matchScore += 10;
          detectedFrom = "explicit_mention";
        }

        // Match parcial - palavras do serviço aparecem na mensagem
        serviceWords.forEach((word) => {
          if (content.includes(word)) {
            matchScore += 3;
          }
        });

        // Match por categoria
        if (categoryLower && content.includes(categoryLower)) {
          matchScore += 2;
        }

        // Se é mensagem do cliente com palavras de interesse + menção ao serviço
        if (isFromCustomer && matchScore > 0) {
          const hasInterestKeyword = interestKeywords.some((kw) => content.includes(kw));
          if (hasInterestKeyword) {
            matchScore *= 2; // Dobra a pontuação se tem interesse explícito

            // Detecta o tipo de interesse
            if (content.includes("preço") || content.includes("valor") || content.includes("custa")) {
              detectedFrom = "price_question";
            } else if (content.includes("funciona") || content.includes("detalhes") || content.includes("inclui")) {
              detectedFrom = "details_question";
            }
          }
        }

        // Aplica peso de recência
        matchScore *= recencyWeight;

        // Acumula pontuação
        if (matchScore > 0) {
          const current = serviceScores.get(service.id) || { score: 0, detectedFrom: "explicit_mention" };
          serviceScores.set(service.id, {
            score: current.score + matchScore,
            detectedFrom: matchScore > current.score ? detectedFrom : current.detectedFrom,
          });
        }
      });
    });

    // Verifica também a mensagem atual (maior peso)
    const currentLower = currentMessage.toLowerCase();
    services.forEach((service) => {
      const serviceLower = service.name.toLowerCase();
      if (currentLower.includes(serviceLower)) {
        const current = serviceScores.get(service.id) || { score: 0, detectedFrom: "explicit_mention" };
        serviceScores.set(service.id, {
          score: current.score + 20, // Alto peso para mensagem atual
          detectedFrom: "explicit_mention",
        });
      }
    });

    // Encontra o serviço com maior pontuação
    let bestService: { id: string; score: number; detectedFrom: ServiceContext["detectedFrom"] } | null = null;
    serviceScores.forEach((data, serviceId) => {
      if (!bestService || data.score > bestService.score) {
        bestService = { id: serviceId, score: data.score, detectedFrom: data.detectedFrom };
      }
    });

    // Se encontrou um serviço com pontuação mínima
    if (bestService && bestService.score >= 5) {
      const service = services.find((s) => s.id === bestService!.id);
      if (service) {
        // Calcula confiança (normalizada entre 0-1)
        const confidence = Math.min(bestService.score / 30, 1);

        return {
          serviceId: service.id,
          serviceName: service.name,
          servicePrice: `R$ ${service.basePrice.toFixed(2).replace(".", ",")}`,
          serviceDuration: service.duration || undefined,
          confidence,
          detectedFrom: bestService.detectedFrom,
        };
      }
    }

    return null;
  }

  /**
   * Detecta a intenção do cliente na mensagem atual
   */
  private detectCustomerIntent(message: string): ConversationContextResult["customerIntent"] {
    const lower = message.toLowerCase();

    // Intenção de agendamento
    const schedulingKeywords = [
      "agendar",
      "marcar",
      "reservar",
      "quero fazer",
      "vou querer",
      "pode marcar",
      "marca pra mim",
      "agenda pra mim",
      "qual horário",
      "horários disponíveis",
      "tem vaga",
      "tem disponibilidade",
    ];
    if (schedulingKeywords.some((kw) => lower.includes(kw))) {
      return "scheduling";
    }

    // Intenção de preço
    const pricingKeywords = ["preço", "valor", "custa", "quanto", "orçamento", "tabela"];
    if (pricingKeywords.some((kw) => lower.includes(kw))) {
      return "pricing";
    }

    // Intenção de informação
    const infoKeywords = ["como funciona", "o que é", "detalhes", "mais informações", "me explica", "o que inclui"];
    if (infoKeywords.some((kw) => lower.includes(kw))) {
      return "information";
    }

    // Intenção de comparação
    const comparisonKeywords = ["diferença", "melhor", "qual", "comparar", "entre"];
    if (comparisonKeywords.some((kw) => lower.includes(kw))) {
      return "comparison";
    }

    return "unknown";
  }

  /**
   * Extrai tópicos recentes da conversa
   */
  private extractRecentTopics(
    messages: Array<{ content: string; direction: string }>,
    services: Array<{ name: string; category: string | null }>
  ): string[] {
    const topics: Set<string> = new Set();

    messages.forEach((msg) => {
      if (msg.direction === "INBOUND") {
        const content = msg.content.toLowerCase();

        // Adiciona serviços mencionados
        services.forEach((service) => {
          if (content.includes(service.name.toLowerCase())) {
            topics.add(service.name);
          }
          if (service.category && content.includes(service.category.toLowerCase())) {
            topics.add(service.category);
          }
        });
      }
    });

    return Array.from(topics);
  }

  /**
   * Formata o contexto detectado para incluir no prompt da IA
   */
  formatContextForPrompt(context: ConversationContextResult): string {
    if (!context.detectedService) {
      return "";
    }

    let formatted = "\n### 🎯 CONTEXTO DA CONVERSA ATUAL\n\n";
    formatted += "**IMPORTANTE:** O cliente já demonstrou interesse em um serviço específico!\n\n";
    formatted += `**Serviço de interesse detectado:** ${context.detectedService.serviceName}\n`;
    formatted += `**Preço:** ${context.detectedService.servicePrice}\n`;
    formatted += `**Confiança:** ${Math.round(context.detectedService.confidence * 100)}%\n`;
    formatted += `**Detectado via:** ${this.translateDetectedFrom(context.detectedService.detectedFrom)}\n\n`;

    if (context.customerIntent === "scheduling") {
      formatted += `⚡ **AÇÃO RECOMENDADA:** O cliente quer AGENDAR! Já sabemos que é o serviço "${context.detectedService.serviceName}". `;
      formatted += `NÃO pergunte qual serviço - vá direto para coletar data/horário.\n`;
    }

    if (context.recentTopics.length > 0) {
      formatted += `\n**Tópicos recentes na conversa:** ${context.recentTopics.join(", ")}\n`;
    }

    return formatted;
  }

  /**
   * Traduz o tipo de detecção para texto legível
   */
  private translateDetectedFrom(detectedFrom: ServiceContext["detectedFrom"]): string {
    const translations: Record<ServiceContext["detectedFrom"], string> = {
      explicit_mention: "Menção direta ao serviço",
      price_question: "Pergunta sobre preço",
      details_question: "Pergunta sobre detalhes/funcionamento",
      comparison: "Comparação entre serviços",
    };
    return translations[detectedFrom];
  }
}

export const conversationContextService = new ConversationContextService();
export default conversationContextService;
