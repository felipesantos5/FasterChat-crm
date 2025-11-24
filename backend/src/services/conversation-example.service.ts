import { prisma } from '../utils/prisma';

class ConversationExampleService {
  /**
   * Marca uma conversa como exemplo
   */
  async markAsExample(companyId: string, conversationId: string, notes?: string) {
    try {
      // Verifica se a conversa existe e pertence à empresa
      const conversation = await prisma.conversation.findFirst({
        where: {
          id: conversationId,
          companyId,
        },
      });

      if (!conversation) {
        throw new Error('Conversation not found or does not belong to this company');
      }

      // Verifica se já existe um exemplo para esta conversa
      const existingExample = await prisma.conversationExample.findUnique({
        where: { conversationId },
      });

      if (existingExample) {
        // Atualiza as notas se já existe
        const updated = await prisma.conversationExample.update({
          where: { conversationId },
          data: { notes },
        });
        return updated;
      }

      // Cria novo exemplo
      const example = await prisma.conversationExample.create({
        data: {
          companyId,
          conversationId,
          notes,
        },
      });

      console.log(`Conversation ${conversationId} marked as example`);
      return example;
    } catch (error: any) {
      console.error('Error marking conversation as example:', error);
      throw new Error(`Failed to mark conversation as example: ${error.message}`);
    }
  }

  /**
   * Remove marcação de exemplo de uma conversa
   */
  async removeExample(conversationId: string, companyId: string) {
    try {
      // Verifica se o exemplo existe e pertence à empresa
      const example = await prisma.conversationExample.findFirst({
        where: {
          conversationId,
          companyId,
        },
      });

      if (!example) {
        throw new Error('Example not found or does not belong to this company');
      }

      await prisma.conversationExample.delete({
        where: { conversationId },
      });

      console.log(`Example removed for conversation ${conversationId}`);
      return { success: true };
    } catch (error: any) {
      console.error('Error removing example:', error);
      throw new Error(`Failed to remove example: ${error.message}`);
    }
  }

  /**
   * Lista todos os exemplos de uma empresa com suas mensagens
   */
  async getExamples(companyId: string) {
    try {
      const examples = await prisma.conversationExample.findMany({
        where: { companyId },
        include: {
          conversation: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  phone: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Para cada exemplo, busca as mensagens
      const examplesWithMessages = await Promise.all(
        examples.map(async (example) => {
          const messages = await prisma.message.findMany({
            where: {
              customerId: example.conversation.customerId,
            },
            select: {
              id: true,
              direction: true,
              content: true,
              timestamp: true,
              senderType: true,
            },
            orderBy: {
              timestamp: 'asc',
            },
          });

          return {
            ...example,
            conversation: {
              ...example.conversation,
              messages,
            },
          };
        })
      );

      return examplesWithMessages;
    } catch (error: any) {
      console.error('Error getting examples:', error);
      throw new Error(`Failed to get examples: ${error.message}`);
    }
  }

  /**
   * Busca exemplos formatados para incluir no prompt da IA
   */
  async getExamplesForPrompt(companyId: string): Promise<string> {
    try {
      const examples = await this.getExamples(companyId);

      if (examples.length === 0) {
        return '';
      }

      // Formata exemplos para o prompt
      const formattedExamples = examples.map((example, index) => {
        const customerName = example.conversation.customer.name;
        const notes = example.notes ? `\nNota: ${example.notes}` : '';

        const messagesText = example.conversation.messages
          .map((msg) => {
            const sender = msg.direction === 'INBOUND'
              ? customerName
              : `Assistente${msg.senderType === 'AI' ? ' (IA)' : ''}`;
            return `${sender}: ${msg.content}`;
          })
          .join('\n');

        return `EXEMPLO ${index + 1}:${notes}
${messagesText}`;
      }).join('\n\n---\n\n');

      return formattedExamples;
    } catch (error: any) {
      console.error('Error formatting examples for prompt:', error);
      return ''; // Retorna vazio em caso de erro para não quebrar o prompt
    }
  }

  /**
   * Verifica se uma conversa está marcada como exemplo
   */
  async isMarkedAsExample(conversationId: string): Promise<boolean> {
    try {
      const example = await prisma.conversationExample.findUnique({
        where: { conversationId },
      });
      return !!example;
    } catch (error) {
      return false;
    }
  }
}

export default new ConversationExampleService();
