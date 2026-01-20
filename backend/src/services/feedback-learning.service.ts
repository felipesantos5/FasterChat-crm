import { prisma } from "../utils/prisma";

/**
 * ============================================
 * FEEDBACK LEARNING SERVICE
 * ============================================
 * Serviço responsável por usar os feedbacks dos usuários
 * para melhorar as respostas da IA em tempo real.
 *
 * A IA aprende com:
 * - Feedbacks NEGATIVOS (BAD): O que evitar fazer
 * - Feedbacks POSITIVOS (GOOD): Exemplos de boas respostas
 */

interface FeedbackExample {
  customerMessage: string;
  aiResponse: string;
  feedback: "GOOD" | "BAD";
  feedbackNote?: string | null;
  timestamp: Date;
}

interface FeedbackContext {
  goodExamples: FeedbackExample[];
  badExamples: FeedbackExample[];
  totalGood: number;
  totalBad: number;
  learningInsights: string[];
}

class FeedbackLearningService {
  /**
   * Busca feedbacks relevantes para usar no contexto da IA
   */
  async getFeedbackContext(companyId: string, limit: number = 10): Promise<FeedbackContext> {
    // Busca mensagens com feedback BAD (prioridade para os que têm nota)
    const badMessages = await prisma.message.findMany({
      where: {
        customer: { companyId },
        senderType: "AI",
        feedback: "BAD",
      },
      orderBy: [
        { feedbackNote: "desc" }, // Prioriza os que têm nota explicativa
        { timestamp: "desc" },
      ],
      take: limit,
      include: {
        customer: {
          select: { id: true },
        },
      },
    });

    // Busca mensagens com feedback GOOD (exemplos positivos)
    const goodMessages = await prisma.message.findMany({
      where: {
        customer: { companyId },
        senderType: "AI",
        feedback: "GOOD",
      },
      orderBy: { timestamp: "desc" },
      take: limit,
      include: {
        customer: {
          select: { id: true },
        },
      },
    });

    // Para cada mensagem da IA, busca a mensagem anterior do cliente (contexto)
    const badExamples = await this.enrichWithCustomerContext(badMessages);
    const goodExamples = await this.enrichWithCustomerContext(goodMessages);

    // Conta totais
    const [totalGood, totalBad] = await Promise.all([
      prisma.message.count({
        where: { customer: { companyId }, senderType: "AI", feedback: "GOOD" },
      }),
      prisma.message.count({
        where: { customer: { companyId }, senderType: "AI", feedback: "BAD" },
      }),
    ]);

    // Gera insights baseados nos feedbacks
    const learningInsights = this.generateInsights(badExamples, goodExamples);

    return {
      goodExamples,
      badExamples,
      totalGood,
      totalBad,
      learningInsights,
    };
  }

  /**
   * Enriquece as mensagens da IA com o contexto da mensagem do cliente
   */
  private async enrichWithCustomerContext(aiMessages: any[]): Promise<FeedbackExample[]> {
    const examples: FeedbackExample[] = [];

    for (const aiMsg of aiMessages) {
      // Busca a mensagem anterior do cliente (que gerou essa resposta)
      const previousCustomerMsg = await prisma.message.findFirst({
        where: {
          customerId: aiMsg.customerId,
          timestamp: { lt: aiMsg.timestamp },
          direction: "INBOUND",
        },
        orderBy: { timestamp: "desc" },
      });

      if (previousCustomerMsg) {
        examples.push({
          customerMessage: previousCustomerMsg.content,
          aiResponse: aiMsg.content,
          feedback: aiMsg.feedback,
          feedbackNote: aiMsg.feedbackNote,
          timestamp: aiMsg.timestamp,
        });
      }
    }

    return examples;
  }

  /**
   * Gera insights automáticos baseados nos padrões de feedback
   */
  private generateInsights(badExamples: FeedbackExample[], goodExamples: FeedbackExample[]): string[] {
    const insights: string[] = [];

    // Analisa notas de feedback negativo para extrair padrões
    const badNotes = badExamples
      .filter((e) => e.feedbackNote && e.feedbackNote.trim().length > 0)
      .map((e) => e.feedbackNote!.toLowerCase());

    // Detecta padrões comuns nas reclamações
    const patterns = {
      preco: ["preço", "valor", "caro", "barato", "custo"],
      informacao: ["errado", "incorreto", "informação", "dado errado"],
      tom: ["grosso", "rude", "educado", "gentil", "tom"],
      resposta: ["longa", "curta", "resumo", "detalhe"],
      entendimento: ["não entendeu", "entendeu errado", "confundiu"],
    };

    for (const [category, keywords] of Object.entries(patterns)) {
      const count = badNotes.filter((note) =>
        keywords.some((kw) => note.includes(kw))
      ).length;

      if (count >= 2) {
        switch (category) {
          case "preco":
            insights.push("Atenção redobrada ao informar preços - houve reclamações sobre valores incorretos");
            break;
          case "informacao":
            insights.push("Verifique as informações antes de responder - feedbacks indicam dados incorretos");
            break;
          case "tom":
            insights.push("Ajuste o tom das respostas - clientes mencionaram problemas com a forma de comunicação");
            break;
          case "resposta":
            insights.push("Ajuste o tamanho das respostas - feedbacks indicam insatisfação com o nível de detalhe");
            break;
          case "entendimento":
            insights.push("Preste mais atenção ao que o cliente está pedindo - houve casos de má interpretação");
            break;
        }
      }
    }

    return insights;
  }

  /**
   * Formata o contexto de feedback para inclusão no prompt da IA
   */
  formatFeedbackForPrompt(context: FeedbackContext): string {
    if (context.badExamples.length === 0 && context.goodExamples.length === 0) {
      return "";
    }

    let formatted = "\n### 📊 APRENDIZADO COM FEEDBACKS DOS ATENDENTES\n\n";

    // Adiciona insights gerais
    if (context.learningInsights.length > 0) {
      formatted += "**⚠️ ALERTAS BASEADOS EM FEEDBACKS:**\n";
      context.learningInsights.forEach((insight) => {
        formatted += `- ${insight}\n`;
      });
      formatted += "\n";
    }

    // Adiciona exemplos de respostas RUINS (o que evitar)
    const badWithNotes = context.badExamples.filter(
      (e) => e.feedbackNote && e.feedbackNote.trim().length > 0
    );

    if (badWithNotes.length > 0) {
      formatted += "**❌ RESPOSTAS QUE RECEBERAM FEEDBACK NEGATIVO (EVITE REPETIR):**\n\n";

      badWithNotes.slice(0, 5).forEach((example, index) => {
        formatted += `**Exemplo ${index + 1}:**\n`;
        formatted += `- Cliente perguntou: "${this.truncate(example.customerMessage, 150)}"\n`;
        formatted += `- Resposta problemática: "${this.truncate(example.aiResponse, 200)}"\n`;
        formatted += `- Motivo da reclamação: "${example.feedbackNote}"\n\n`;
      });
    }

    // Adiciona exemplos de respostas BOAS (o que seguir)
    if (context.goodExamples.length > 0) {
      formatted += "**✅ RESPOSTAS QUE RECEBERAM FEEDBACK POSITIVO (USE COMO REFERÊNCIA):**\n\n";

      context.goodExamples.slice(0, 3).forEach((example, index) => {
        formatted += `**Exemplo ${index + 1}:**\n`;
        formatted += `- Cliente perguntou: "${this.truncate(example.customerMessage, 150)}"\n`;
        formatted += `- Boa resposta: "${this.truncate(example.aiResponse, 200)}"\n\n`;
      });
    }

    // Estatísticas
    const total = context.totalGood + context.totalBad;
    if (total > 0) {
      const approvalRate = Math.round((context.totalGood / total) * 100);
      formatted += `**📈 Taxa de aprovação atual: ${approvalRate}%** (${context.totalGood} positivos, ${context.totalBad} negativos)\n`;

      if (approvalRate < 70) {
        formatted += `⚠️ A taxa de aprovação está abaixo do ideal. Preste atenção extra na qualidade das respostas.\n`;
      }
    }

    return formatted;
  }

  /**
   * Trunca texto para não estourar o contexto
   */
  private truncate(text: string, maxLength: number): string {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  }

  /**
   * Busca feedbacks recentes para uma conversa específica
   * Útil para personalizar o atendimento por cliente
   */
  async getCustomerFeedbackHistory(customerId: string): Promise<{
    recentBadFeedbacks: number;
    lastFeedbackNote: string | null;
  }> {
    const recentBad = await prisma.message.count({
      where: {
        customerId,
        senderType: "AI",
        feedback: "BAD",
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Últimos 7 dias
        },
      },
    });

    const lastBadWithNote = await prisma.message.findFirst({
      where: {
        customerId,
        senderType: "AI",
        feedback: "BAD",
        feedbackNote: { not: null },
      },
      orderBy: { timestamp: "desc" },
      select: { feedbackNote: true },
    });

    return {
      recentBadFeedbacks: recentBad,
      lastFeedbackNote: lastBadWithNote?.feedbackNote || null,
    };
  }
}

export const feedbackLearningService = new FeedbackLearningService();
export default feedbackLearningService;
