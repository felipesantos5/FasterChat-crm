export enum MessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum MessageStatus {
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  FAILED = 'FAILED',
}

export enum SenderType {
  HUMAN = 'HUMAN',
  AI = 'AI',
}

export enum MessageFeedback {
  GOOD = 'GOOD',
  BAD = 'BAD',
}

export interface Message {
  id: string;
  customerId: string;
  whatsappInstanceId: string;
  direction: MessageDirection;
  content: string;
  timestamp: string;
  status: MessageStatus;
  messageId?: string | null;
  senderType?: SenderType | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  feedback?: MessageFeedback | null;
  feedbackNote?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
}

export interface GetMessagesResponse {
  success: boolean;
  data: {
    messages: Message[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface GetCustomerMessagesResponse {
  success: boolean;
  data: {
    messages: Message[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ConversationSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerProfilePic: string | null; // URL da foto de perfil do WhatsApp
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  direction: MessageDirection;
  aiEnabled: boolean;
  needsHelp: boolean;
  isGroup: boolean; // Identifica se é um grupo do WhatsApp
  assignedToId: string | null;
  assignedToName: string | null;
  whatsappInstanceId: string; // ID da instância do WhatsApp
  whatsappInstanceName: string; // Nome da instância
}

export interface GetConversationsResponse {
  success: boolean;
  data: ConversationSummary[];
}

export interface MarkAsReadRequest {
  customerId: string;
  whatsappInstanceId: string;
}

export interface MarkAsReadResponse {
  success: boolean;
  data: {
    success: boolean;
  };
}
