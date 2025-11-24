import { prisma } from '../utils/prisma';
import { MessageDirection, MessageStatus } from '@prisma/client';
import {
  CreateMessageRequest,
  GetMessagesRequest,
  ConversationSummary,
} from '../types/message';

class MessageService {
  /**
   * Cria uma nova mensagem
   */
  async createMessage(data: CreateMessageRequest) {
    try {
      const message = await prisma.message.create({
        data: {
          customerId: data.customerId,
          whatsappInstanceId: data.whatsappInstanceId,
          direction: data.direction,
          content: data.content,
          timestamp: data.timestamp,
          status: data.status || MessageStatus.SENT,
          messageId: data.messageId,
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      return message;
    } catch (error: any) {
      console.error('Error creating message:', error);
      throw new Error(`Failed to create message: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens com filtros
   */
  async getMessages(filters: GetMessagesRequest) {
    try {
      const {
        customerId,
        whatsappInstanceId,
        direction,
        limit = 50,
        offset = 0,
      } = filters;

      const where: any = {};

      if (customerId) where.customerId = customerId;
      if (whatsappInstanceId) where.whatsappInstanceId = whatsappInstanceId;
      if (direction) where.direction = direction;

      const messages = await prisma.message.findMany({
        where,
        include: {
          customer: true,
          whatsappInstance: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
        skip: offset,
      });

      const total = await prisma.message.count({ where });

      return {
        messages,
        total,
        limit,
        offset,
      };
    } catch (error: any) {
      console.error('Error getting messages:', error);
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  }

  /**
   * Obtém mensagens de um customer específico
   */
  async getCustomerMessages(customerId: string, limit = 50, offset = 0) {
    return this.getMessages({
      customerId,
      limit,
      offset,
    });
  }

  /**
   * Atualiza o status de uma mensagem pelo ID interno
   */
  async updateMessageStatus(id: string, status: MessageStatus) {
    try {
      const message = await prisma.message.update({
        where: { id },
        data: { status },
      });

      return message;
    } catch (error: any) {
      console.error('Error updating message status:', error);
      throw new Error(`Failed to update message status: ${error.message}`);
    }
  }

  /**
   * Obtém resumo de conversas (última mensagem por customer)
   */
  async getConversations(companyId: string): Promise<ConversationSummary[]> {
    try {
      // Busca todas as mensagens da empresa ordenadas por timestamp
      const messages = await prisma.message.findMany({
        where: {
          customer: {
            companyId,
          },
        },
        include: {
          customer: true,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      // Agrupa por customer e pega a última mensagem de cada um
      const conversationsMap = new Map<string, ConversationSummary>();

      for (const message of messages) {
        if (!conversationsMap.has(message.customerId)) {
          conversationsMap.set(message.customerId, {
            customerId: message.customerId,
            customerName: message.customer.name,
            customerPhone: message.customer.phone,
            lastMessage: message.content,
            lastMessageTimestamp: message.timestamp,
            unreadCount: 0, // TODO: implementar lógica de não lidas
            direction: message.direction,
          });
        }
      }

      return Array.from(conversationsMap.values());
    } catch (error: any) {
      console.error('Error getting conversations:', error);
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
  }

  /**
   * Processa mensagem recebida via webhook
   */
  async processInboundMessage(
    instanceName: string,
    remoteJid: string,
    content: string,
    messageId: string,
    timestamp: Date,
    pushName?: string
  ) {
    try {
      // Busca a instância pelo nome
      const instance = await prisma.whatsAppInstance.findFirst({
        where: { instanceName },
      });

      if (!instance) {
        throw new Error(`WhatsApp instance not found: ${instanceName}`);
      }

      // Extrai o número de telefone do remoteJid (remove @s.whatsapp.net)
      const phone = remoteJid.replace('@s.whatsapp.net', '');

      // Busca ou cria o customer
      let customer = await prisma.customer.findFirst({
        where: {
          companyId: instance.companyId,
          phone,
        },
      });

      if (!customer) {
        // Cria novo customer
        customer = await prisma.customer.create({
          data: {
            companyId: instance.companyId,
            name: pushName || phone,
            phone,
          },
        });

        console.log(`New customer created: ${customer.id} - ${customer.name}`);
      }

      // Cria a mensagem
      const message = await this.createMessage({
        customerId: customer.id,
        whatsappInstanceId: instance.id,
        direction: MessageDirection.INBOUND,
        content,
        timestamp,
        messageId,
        status: MessageStatus.DELIVERED,
      });

      console.log(`Inbound message saved: ${message.id}`);

      // TODO: Disparar evento para IA processar
      // eventEmitter.emit('message:inbound', message);

      return {
        message,
        customer,
        instance,
      };
    } catch (error: any) {
      console.error('Error processing inbound message:', error);
      throw new Error(`Failed to process inbound message: ${error.message}`);
    }
  }

  /**
   * Marca mensagens como lidas
   */
  async markAsRead(customerId: string, whatsappInstanceId: string) {
    try {
      await prisma.message.updateMany({
        where: {
          customerId,
          whatsappInstanceId,
          direction: MessageDirection.INBOUND,
          status: {
            not: MessageStatus.READ,
          },
        },
        data: {
          status: MessageStatus.READ,
        },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  }

  /**
   * Deleta todas as mensagens de um customer
   */
  async deleteCustomerMessages(customerId: string) {
    try {
      await prisma.message.deleteMany({
        where: { customerId },
      });

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting messages:', error);
      throw new Error(`Failed to delete messages: ${error.message}`);
    }
  }

  /**
   * Envia uma mensagem para um customer via WhatsApp
   */
  async sendMessage(customerId: string, content: string, sentBy: 'HUMAN' | 'AI' = 'HUMAN') {
    try {
      // Busca o customer com sua empresa
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          company: {
            include: {
              whatsappInstances: {
                where: {
                  status: 'CONNECTED',
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Verifica se há uma instância conectada
      const whatsappInstance = customer.company.whatsappInstances[0];
      if (!whatsappInstance) {
        throw new Error('No connected WhatsApp instance found for this company');
      }

      // Importa o whatsappService dinamicamente para evitar dependência circular
      const whatsappService = (await import('./whatsapp.service')).default;

      // Envia a mensagem via WhatsApp
      const result = await whatsappService.sendMessage({
        instanceId: whatsappInstance.id,
        to: customer.phone,
        text: content,
      });

      // Salva a mensagem no banco com senderType
      const message = await prisma.message.create({
        data: {
          customerId: customer.id,
          whatsappInstanceId: whatsappInstance.id,
          direction: MessageDirection.OUTBOUND,
          content,
          timestamp: new Date(),
          messageId: result.messageId,
          status: MessageStatus.SENT,
          senderType: sentBy,
        },
        include: {
          customer: true,
          whatsappInstance: true,
        },
      });

      return {
        message,
        whatsappResult: result,
        sentBy,
      };
    } catch (error: any) {
      console.error('Error sending message:', error);
      throw new Error(`Failed to send message: ${error.message}`);
    }
  }
}

export default new MessageService();
