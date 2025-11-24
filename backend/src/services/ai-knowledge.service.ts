import { prisma } from '../utils/prisma';
import { UpdateAIKnowledgeRequest } from '../types/ai-knowledge';

class AIKnowledgeService {
  /**
   * Obtém a base de conhecimento de uma empresa
   */
  async getKnowledge(companyId: string) {
    try {
      const knowledge = await prisma.aIKnowledge.findUnique({
        where: { companyId },
      });

      return knowledge;
    } catch (error: any) {
      console.error('Error getting AI knowledge:', error);
      throw new Error(`Failed to get AI knowledge: ${error.message}`);
    }
  }

  /**
   * Cria ou atualiza a base de conhecimento
   */
  async upsertKnowledge(companyId: string, data: UpdateAIKnowledgeRequest) {
    try {
      console.log('[AI Knowledge Service] Upserting knowledge with data:', {
        companyId,
        provider: data.provider,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        autoReplyEnabled: data.autoReplyEnabled,
      });

      const knowledge = await prisma.aIKnowledge.upsert({
        where: { companyId },
        update: {
          companyInfo: data.companyInfo,
          productsServices: data.productsServices,
          toneInstructions: data.toneInstructions,
          policies: data.policies,
          // Configurações avançadas
          provider: data.provider,
          model: data.model,
          temperature: data.temperature,
          maxTokens: data.maxTokens,
          autoReplyEnabled: data.autoReplyEnabled,
        },
        create: {
          companyId,
          companyInfo: data.companyInfo,
          productsServices: data.productsServices,
          toneInstructions: data.toneInstructions,
          policies: data.policies,
          // Configurações avançadas
          provider: data.provider || 'openai',
          model: data.model,
          temperature: data.temperature ?? 0.7,
          maxTokens: data.maxTokens ?? 500,
          autoReplyEnabled: data.autoReplyEnabled ?? true,
        },
      });

      console.log(`✓ AI knowledge updated for company ${companyId}`, {
        provider: knowledge.provider,
        temperature: knowledge.temperature,
        maxTokens: knowledge.maxTokens,
        autoReplyEnabled: knowledge.autoReplyEnabled,
      });

      return knowledge;
    } catch (error: any) {
      console.error('✗ Error upserting AI knowledge:', error);
      throw new Error(`Failed to upsert AI knowledge: ${error.message}`);
    }
  }

  /**
   * Formata a base de conhecimento para uso pela IA
   */
  formatKnowledgeForAI(knowledge: any): string {
    if (!knowledge) {
      return 'Nenhuma informação adicional disponível.';
    }

    let formatted = '';

    if (knowledge.companyInfo) {
      formatted += `## Sobre a Empresa\n${knowledge.companyInfo}\n\n`;
    }

    if (knowledge.productsServices) {
      formatted += `## Produtos e Serviços\n${knowledge.productsServices}\n\n`;
    }

    if (knowledge.toneInstructions) {
      formatted += `## Tom de Voz e Instruções\n${knowledge.toneInstructions}\n\n`;
    }

    if (knowledge.policies) {
      formatted += `## Políticas Importantes\n${knowledge.policies}\n\n`;
    }

    return formatted || 'Nenhuma informação adicional disponível.';
  }
}

export default new AIKnowledgeService();
