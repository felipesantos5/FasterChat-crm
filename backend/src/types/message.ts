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
  quotedContent?: string;
  quotedAuthor?: string;
}

export interface GetMessagesRequest {
  customerId?: string;
  whatsappInstanceId?: string;
  direction?: MessageDirection;
  limit?: number;
  offset?: number;
}

// Evolution API Webhook Payload Types

interface EvolutionQuotedMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string; fileName?: string };
  audioMessage?: Record<string, unknown>;
  videoMessage?: { caption?: string };
  documentMessage?: { fileName?: string };
  stickerMessage?: Record<string, unknown>;
}

interface EvolutionContextInfo {
  stanzaId?: string;
  participant?: string;
  quotedMessage?: EvolutionQuotedMessage;
}

export interface EvolutionWebhookMessage {
  lastDisconnect?: {
    error?: {
      output?: {
        statusCode?: number;
      };
    };
  };
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string; // em mensagens de grupo
  };
  // campos extras retornados pela Evolution API para resolução de LID/JID
  senderPn?: string;
  remoteJidAlt?: string;
  owner?: string;
  messageStubParameters?: string[];
  message?: {
    conversation?: string;
    contextInfo?: EvolutionContextInfo; // contextInfo no nível raiz (alguns clientes)
    extendedTextMessage?: {
      text: string;
      contextInfo?: EvolutionContextInfo;
    };
    imageMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string;
      contextInfo?: EvolutionContextInfo;
    };
    audioMessage?: {
      url?: string;
      mimetype?: string;
      base64?: string;
      seconds?: number;
      contextInfo?: EvolutionContextInfo;
    };
    videoMessage?: {
      caption?: string;
      url?: string;
      mimetype?: string;
      base64?: string;
      contextInfo?: EvolutionContextInfo;
    };
    documentMessage?: {
      fileName?: string;
      url?: string;
      mimetype?: string;
      contextInfo?: EvolutionContextInfo;
    };
    stickerMessage?: {
      url?: string;
      mimetype?: string;
      contextInfo?: EvolutionContextInfo;
    };
    locationMessage?: {
      degreesLatitude?: number;
      degreesLongitude?: number;
      name?: string;
      address?: string;
    };
    contactMessage?: {
      displayName?: string;
      vcard?: string;
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
  customerProfilePic: string | null; // URL da foto de perfil do WhatsApp
  lastMessage: string;
  lastMessageTimestamp: Date;
  unreadCount: number;
  direction: MessageDirection;
  aiEnabled: boolean;
  needsHelp: boolean;
  isGroup: boolean; // Identifica se é um grupo do WhatsApp
  assignedToId: string | null;
  assignedToName: string | null;
  whatsappInstanceId: string; // ID da instância do WhatsApp
  whatsappInstanceName: string; // Nome da instância
  isArchived: boolean; // Contato arquivado
  lastMediaType: string | null; // Tipo de mídia da última mensagem
}
