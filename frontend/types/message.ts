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

export interface Message {
  id: string;
  customerId: string;
  whatsappInstanceId: string;
  direction: MessageDirection;
  content: string;
  timestamp: string;
  status: MessageStatus;
  messageId?: string | null;
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
  lastMessage: string;
  lastMessageTimestamp: string;
  unreadCount: number;
  direction: MessageDirection;
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
