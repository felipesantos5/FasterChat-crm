import { MessageDirection, MessageStatus } from '@prisma/client';

export interface MessageData {
  id: string;
  customerId: string;
  whatsappInstanceId: string;
  direction: MessageDirection;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  messageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMessageRequest {
  customerId: string;
  whatsappInstanceId: string;
  direction: MessageDirection;
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  messageId?: string;
}

export interface GetMessagesRequest {
  customerId?: string;
  whatsappInstanceId?: string;
  direction?: MessageDirection;
  limit?: number;
  offset?: number;
}

// Evolution API Webhook Payload Types
export interface EvolutionWebhookMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
  };
  messageTimestamp: string | number;
  pushName?: string;
  instanceName?: string;
}

export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: EvolutionWebhookMessage;
}

export interface ConversationSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  unreadCount: number;
  direction: MessageDirection;
}
