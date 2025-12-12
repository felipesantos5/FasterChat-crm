import { prisma } from '../utils/prisma';
import { websocketService } from './websocket.service';

class ConversationService {
  /**
   * Busca ou cria uma conversa para um customer
   */
  async getOrCreateConversation(customerId: string, companyId: string) {
    try {
      // Busca conversa existente
      let conversation = await prisma.conversation.findUnique({
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

      // Se não existe, cria uma nova com IA ativada
      const isNewConversation = !conversation;
      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            customerId,
            companyId,
            aiEnabled: true,
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

        console.log(`✨ New conversation created for customer ${customerId}`);

        // 🔥 EMITE EVENTO VIA WEBSOCKET PARA ATUALIZAR LISTA DE CONVERSAS
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

      console.log(`Conversation ${conversation.id} assigned to user ${userId}`);

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

      console.log(`Conversation ${conversation.id} unassigned, AI enabled`);

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
      // Se está ativando a IA, também reseta o needsHelp
      const updateData: { aiEnabled: boolean; needsHelp?: boolean } = { aiEnabled };
      if (aiEnabled) {
        updateData.needsHelp = false;
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

      console.log(`Conversation ${conversation.id} AI ${aiEnabled ? 'enabled' : 'disabled'}${aiEnabled ? ' (needsHelp reset)' : ''}`);

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
}

export default new ConversationService();
