export interface Conversation {
  id: string;
  customerId: string;
  companyId: string;
  assignedToId?: string | null;
  aiEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface GetConversationResponse {
  success: boolean;
  data: Conversation;
}

export interface AssignConversationRequest {
  userId: string;
}

export interface AssignConversationResponse {
  success: boolean;
  data: Conversation;
}
