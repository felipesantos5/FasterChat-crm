import { prisma } from '../utils/prisma';
import ragService from './rag.service';

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

      // Indexa no RAG para busca semântica
      this.indexExampleInRAG(example.id, companyId, conversationId, notes).catch(() => {});

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
            orderBy: [
              { timestamp: 'asc' },
              { createdAt: 'asc' },
            ],
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
   * Cria um exemplo de conversa sintético (fictício)
   */
  async createSyntheticExample(
    companyId: string,
    data: {
      customerName: string;
      messages: Array<{ role: 'customer' | 'assistant'; content: string }>;
      notes?: string;
    }
  ) {
    try {
      // Busca a primeira WhatsApp instance da empresa
      const whatsappInstance = await prisma.whatsAppInstance.findFirst({
        where: { companyId },
      });

      if (!whatsappInstance) {
        throw new Error('No WhatsApp instance found for this company. Please connect WhatsApp first.');
      }

      // Usa transação para criar tudo atomicamente
      const result = await prisma.$transaction(async (tx) => {
        // 1. Cria Customer sintético
        const customer = await tx.customer.create({
          data: {
            companyId,
            name: data.customerName,
            phone: `synthetic-${Date.now()}`,
            tags: ['exemplo-sintetico'],
            notes: 'Cliente sintético criado para exemplo de conversa',
          },
        });

        // 2. Cria Conversation
        const conversation = await tx.conversation.create({
          data: {
            customerId: customer.id,
            companyId,
            aiEnabled: false,
          },
        });

        // 3. Cria Messages
        const now = new Date();
        for (let i = 0; i < data.messages.length; i++) {
          const msg = data.messages[i];
          await tx.message.create({
            data: {
              customerId: customer.id,
              whatsappInstanceId: whatsappInstance.id,
              direction: msg.role === 'customer' ? 'INBOUND' : 'OUTBOUND',
              content: msg.content,
              timestamp: new Date(now.getTime() + i * 60000), // 1 min apart
              senderType: msg.role === 'customer' ? 'HUMAN' : 'AI',
              status: 'DELIVERED',
            },
          });
        }

        // 4. Cria ConversationExample
        const example = await tx.conversationExample.create({
          data: {
            companyId,
            conversationId: conversation.id,
            notes: data.notes || 'Exemplo sintético',
          },
        });

        return example;
      });

      // Indexa no RAG diretamente com os dados sintéticos (não precisa buscar do banco)
      const ragSource = `conversation_example_${result.id}`;
      const notesStr = data.notes ? `\nNota: ${data.notes}` : '';
      const messagesFormatted = data.messages
        .map(msg => `${msg.role === 'customer' ? data.customerName : 'Assistente'}: ${msg.content}`)
        .join('\n');
      const ragText = `[EXEMPLO DE CONVERSA IDEAL]${notesStr}\n${messagesFormatted}`;

      ragService.processAndStore(companyId, ragText, {
        source: ragSource,
        type: 'conversation_example' as any,
      }).catch((err: any) => console.warn('[ConversationExample] Erro ao indexar exemplo no RAG:', err.message));

      console.log(`Synthetic example created for company ${companyId}`);
      return result;
    } catch (error: any) {
      console.error('Error creating synthetic example:', error);
      throw new Error(`Failed to create synthetic example: ${error.message}`);
    }
  }

  /**
   * Deleta um exemplo sintético e todos seus dados associados
   */
  async deleteSyntheticExample(exampleId: string, companyId: string) {
    try {
      // Busca o exemplo com dados da conversa
      const example = await prisma.conversationExample.findFirst({
        where: { id: exampleId, companyId },
        include: {
          conversation: {
            include: {
              customer: true,
            },
          },
        },
      });

      if (!example) {
        throw new Error('Example not found or does not belong to this company');
      }

      const isSynthetic = example.conversation.customer.tags?.includes('exemplo-sintetico');

      await prisma.$transaction(async (tx) => {
        // Deleta o exemplo
        await tx.conversationExample.delete({
          where: { id: exampleId },
        });

        if (isSynthetic) {
          // Para sintéticos, deleta tudo em cascata
          // Mensagens são deletadas via cascade do customer
          await tx.conversation.delete({
            where: { id: example.conversationId },
          });
          await tx.customer.delete({
            where: { id: example.conversation.customerId },
          });
        }
      });

      // Remove do RAG
      const ragSource = `conversation_example_${exampleId}`;
      ragService.clearBySource(example.companyId, ragSource).catch(() => {});

      console.log(`Example ${exampleId} deleted (synthetic: ${isSynthetic})`);
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting example:', error);
      throw new Error(`Failed to delete example: ${error.message}`);
    }
  }

  /**
   * Indexa um exemplo de conversa no RAG para busca semântica
   */
  private async indexExampleInRAG(exampleId: string, companyId: string, conversationId: string, notes?: string) {
    try {
      // Busca as mensagens da conversa
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: { customer: { select: { name: true } } },
      });

      if (!conversation) return;

      const messages = await prisma.message.findMany({
        where: { customerId: conversation.customerId },
        select: { direction: true, content: true, senderType: true },
        orderBy: [{ timestamp: 'asc' }, { createdAt: 'asc' }],
      });

      if (messages.length === 0) return;

      const customerName = conversation.customer.name;
      const notesStr = notes ? `\nNota: ${notes}` : '';
      const messagesFormatted = messages
        .map(msg => {
          const sender = msg.direction === 'INBOUND' ? customerName : `Assistente${msg.senderType === 'AI' ? ' (IA)' : ''}`;
          return `${sender}: ${msg.content}`;
        })
        .join('\n');

      const ragText = `[EXEMPLO DE CONVERSA IDEAL]${notesStr}\n${messagesFormatted}`;
      const ragSource = `conversation_example_${exampleId}`;

      await ragService.processAndStore(companyId, ragText, {
        source: ragSource,
        type: 'conversation_example' as any,
      });
    } catch (err: any) {
      console.warn('[ConversationExample] Erro ao indexar exemplo no RAG:', err.message);
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
