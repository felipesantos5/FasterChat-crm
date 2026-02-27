import { prisma } from "../utils/prisma";

/**
 * Serviço para rastrear conversões de links do WhatsApp
 * Detecta quando um cliente que clicou em um link efetivamente envia uma mensagem
 */
class LinkConversionService {
  // Tempo máximo (em minutos) entre o clique e a mensagem para considerar conversão
  private readonly CONVERSION_WINDOW_MINUTES = 60;

  /**
   * Verifica se uma mensagem recebida corresponde a um clique recente de um link
   * e aplica a tag automática se configurada
   */
  async processMessageConversion(
    phoneNumber: string,
    messageContent: string,
    customerId: string,
    companyId: string
  ): Promise<{ converted: boolean; linkName?: string; tagApplied?: string }> {
    try {
      // Limpa o número de telefone para comparação
      const cleanPhone = this.cleanPhoneNumber(phoneNumber);

      // Busca links da empresa que correspondem ao número de telefone
      const links = await prisma.whatsAppLink.findMany({
        where: {
          companyId,
          isActive: true,
        },
        include: {
          clicks: {
            where: {
              converted: false,
              clickedAt: {
                gte: new Date(Date.now() - this.CONVERSION_WINDOW_MINUTES * 60 * 1000),
              },
            },
            orderBy: {
              clickedAt: "desc",
            },
            take: 100, // Limita para performance
          },
        },
      });

      // Para cada link, verifica se a mensagem corresponde à mensagem pré-preenchida
      for (const link of links) {
        const isMatch = this.isMessageMatch(messageContent, link.message);
        
        if (isMatch && link.clicks.length > 0) {
          // Marca o clique mais recente como convertido
          const recentClick = link.clicks[0];
          
          await prisma.linkClick.update({
            where: { id: recentClick.id },
            data: {
              converted: true,
              convertedAt: new Date(),
              customerId,
            },
          });

          // Se tiver tag automática configurada, aplica ao cliente
          if (link.autoTag) {
            await this.applyTagToCustomer(customerId, link.autoTag, companyId);
          }


          return {
            converted: true,
            linkName: link.name,
            tagApplied: link.autoTag || undefined,
          };
        }
      }

      return { converted: false };
    } catch (error) {
      console.error("[LinkConversion] Error processing conversion:", error);
      return { converted: false };
    }
  }

  /**
   * Verifica se a mensagem corresponde à mensagem pré-preenchida do link
   */
  private isMessageMatch(receivedMessage: string, prefilledMessage: string | null): boolean {
    if (!prefilledMessage) {
      return false;
    }

    // Normaliza as mensagens para comparação
    const normalizedReceived = this.normalizeMessage(receivedMessage);
    const normalizedPrefilled = this.normalizeMessage(prefilledMessage);

    // Verifica se a mensagem recebida contém a mensagem pré-preenchida
    // ou se são muito similares (para casos onde o usuário editou levemente)
    if (normalizedReceived === normalizedPrefilled) {
      return true;
    }

    // Verifica se a mensagem começa com o texto pré-preenchido
    if (normalizedReceived.startsWith(normalizedPrefilled)) {
      return true;
    }

    // Verifica similaridade (pelo menos 80% do texto é igual)
    const similarity = this.calculateSimilarity(normalizedReceived, normalizedPrefilled);
    return similarity >= 0.8;
  }

  /**
   * Normaliza uma mensagem para comparação
   */
  private normalizeMessage(message: string): string {
    return message
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ") // Remove espaços extras
      .replace(/[^\w\s]/g, ""); // Remove caracteres especiais
  }

  /**
   * Calcula a similaridade entre duas strings (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const longerLength = longer.length;
    const distance = this.levenshteinDistance(longer, shorter);

    return (longerLength - distance) / longerLength;
  }

  /**
   * Calcula a distância de Levenshtein entre duas strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    if (m === 0) return n;
    if (n === 0) return m;

    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1, // deletion
          dp[i][j - 1] + 1, // insertion
          dp[i - 1][j - 1] + cost // substitution
        );
      }
    }

    return dp[m][n];
  }

  /**
   * Aplica uma tag ao cliente se ainda não tiver
   */
  private async applyTagToCustomer(customerId: string, tagName: string, companyId: string): Promise<void> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: { tags: true },
      });

      if (!customer) return;

      // Verifica se a tag já existe
      if (customer.tags.includes(tagName)) {
        return; // Já tem a tag
      }

      // Garante que a tag existe na empresa
      await prisma.tag.upsert({
        where: {
          companyId_name: {
            companyId,
            name: tagName,
          },
        },
        create: {
          companyId,
          name: tagName,
          color: "#10B981", // Verde para tags de conversão
        },
        update: {},
      });

      // Adiciona a tag ao cliente
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          tags: {
            push: tagName,
          },
        },
      });

    } catch (error) {
      console.error("[LinkConversion] Error applying tag:", error);
    }
  }

  /**
   * Limpa o número de telefone
   */
  private cleanPhoneNumber(phone: string): string {
    return phone
      .replace(/@s\.whatsapp\.net/gi, "")
      .replace(/@c\.us/gi, "")
      .replace(/\D/g, "");
  }

  /**
   * Obtém estatísticas de conversão de um link
   */
  async getLinkConversionStats(linkId: string): Promise<{
    totalClicks: number;
    conversions: number;
    conversionRate: number;
  }> {
    const [totalClicks, conversions] = await Promise.all([
      prisma.linkClick.count({ where: { linkId } }),
      prisma.linkClick.count({ where: { linkId, converted: true } }),
    ]);

    return {
      totalClicks,
      conversions,
      conversionRate: totalClicks > 0 ? (conversions / totalClicks) * 100 : 0,
    };
  }
}

export const linkConversionService = new LinkConversionService();
