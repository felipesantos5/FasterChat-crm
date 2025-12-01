import { MessageDirection, MessageStatus } from "@prisma/client";

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
  mediaUrl?: any;
  mediaType?: string;
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
  lastDisconnect: any;
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string; // Evolution API pode enviar base64 se configurado
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string; // Evolution API pode enviar base64 se configurado
      seconds?: number;
    };
  };
  statusReason?: any;
  messageTimestamp?: string | number;
  pushName?: string;
  instanceName?: string;
  // Campos de conexão
  state?: string;
  reason?: any;
  connection?: string;
  instance?: {
    wuid?: string;
    state?: string;
  };
  // Campos de QR code
  qrcode?: {
    base64?: string;
    code?: string;
  };
}

export interface EvolutionWebhookPayload {
  event: string;
  instance?: string; // Opcional pois pode não vir em alguns eventos
  data: EvolutionWebhookMessage;
  lastDisconnect?: any;
}

export interface ConversationSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: string;
  lastMessageTimestamp: Date;
  unreadCount: number;
  direction: MessageDirection;
  aiEnabled: boolean;
  needsHelp: boolean;
  assignedToId: string | null;
  assignedToName: string | null;
}
