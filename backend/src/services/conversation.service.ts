import { prisma } from '../utils/prisma';
import { websocketService } from './websocket.service';
import { clearLoopCache } from './handoff-detector.service';

class ConversationService {
  /**
   * Busca ou cria uma conversa para um customer
   */
  async getOrCreateConversation(customerId: string, companyId: string) {
    try {
      // Usa upsert para evitar race condition quando 2 webhooks chegam ao mesmo tempo
      // para o mesmo customer (check-then-act → duplicata)
      const existedBefore = await prisma.conversation.findUnique({
        where: { customerId },
        select: { id: true },
      });

      // Herda o estado global de auto-reply da empresa para novas conversas
      // Se a empresa desligou autoReply, conversas novas já nascem com IA desligada
      let defaultAiEnabled = true;
      if (!existedBefore) {
        try {
          const aiKnowledge = await prisma.aIKnowledge.findUnique({
            where: { companyId },
            select: { autoReplyEnabled: true },
          });
          if (aiKnowledge?.autoReplyEnabled === false) {
            defaultAiEnabled = false;
          }
        } catch {
          // Se falhar ao buscar config, mantém default true
        }
      }

      const conversation = await prisma.conversation.upsert({
        where: { customerId },
        update: {}, // Não altera nada se já existe
        create: {
          customerId,
          companyId,
          aiEnabled: defaultAiEnabled,
        },
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      // 🔥 EMITE EVENTO VIA WEBSOCKET PARA ATUALIZAR LISTA DE CONVERSAS
      if (!existedBefore) {
        websocketService.emitNewConversation(companyId, conversation);
      }

      return conversation;
    } catch (error: any) {
      console.error('Error getting or creating conversation:', error);
      throw new Error(`Failed to get or create conversation: ${error.message}`);
    }
  }

  /**
   * Atribui uma conversa a um usuário e desliga a IA
   */
  async assignConversation(customerId: string, userId: string) {
    try {
      const conversation = await prisma.conversation.update({
        where: { customerId },
        data: {
          assignedToId: userId,
          aiEnabled: false, // Desliga a IA quando atribuído a humano
        },
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });


      return conversation;
    } catch (error: any) {
      console.error('Error assigning conversation:', error);
      throw new Error(`Failed to assign conversation: ${error.message}`);
    }
  }

  /**
   * Remove a atribuição e religa a IA
   */
  async unassignConversation(customerId: string) {
    try {
      const conversation = await prisma.conversation.update({
        where: { customerId },
        data: {
          assignedToId: null,
          aiEnabled: true, // Religa a IA quando liberado
        },
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });


      return conversation;
    } catch (error: any) {
      console.error('Error unassigning conversation:', error);
      throw new Error(`Failed to unassign conversation: ${error.message}`);
    }
  }

  /**
   * Obtém uma conversa por customerId
   */
  async getConversation(customerId: string) {
    try {
      const conversation = await prisma.conversation.findUnique({
        where: { customerId },
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return conversation;
    } catch (error: any) {
      console.error('Error getting conversation:', error);
      throw new Error(`Failed to get conversation: ${error.message}`);
    }
  }

  /**
   * Ativa/Desativa IA em uma conversa
   * Quando a IA é ATIVADA, também reseta o flag needsHelp (remove aviso de transbordo)
   */
  async toggleAI(customerId: string, aiEnabled: boolean) {
    try {
      // Se está ativando a IA, também reseta o needsHelp e limpa cache de loop
      const updateData: { aiEnabled: boolean; needsHelp?: boolean } = { aiEnabled };
      if (aiEnabled) {
        updateData.needsHelp = false;
        clearLoopCache(customerId);
      }

      const conversation = await prisma.conversation.update({
        where: { customerId },
        data: updateData,
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });


      return conversation;
    } catch (error: any) {
      console.error('Error toggling AI:', error);
      throw new Error(`Failed to toggle AI: ${error.message}`);
    }
  }

  /**
   * Lista conversas atribuídas a um usuário
   */
  async getAssignedConversations(userId: string) {
    try {
      const conversations = await prisma.conversation.findMany({
        where: { assignedToId: userId },
        include: {
          customer: true,
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      return conversations;
    } catch (error: any) {
      console.error('Error getting assigned conversations:', error);
      throw new Error(`Failed to get assigned conversations: ${error.message}`);
    }
  }

  /**
   * Conta conversas que transbordaram (needsHelp = true) e não foram atendidas
   */
  async getHandoffsCount(companyId: string): Promise<number> {
    try {
      const count = await prisma.conversation.count({
        where: {
          companyId,
          needsHelp: true,
          assignedToId: null, // Ainda não foi atribuída a ninguém
        },
      });

      return count;
    } catch (error: any) {
      console.error('Error getting handoffs count:', error);
      throw new Error(`Failed to get handoffs count: ${error.message}`);
    }
  }
}

export default new ConversationService();
