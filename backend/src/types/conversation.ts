export interface ConversationData {
  id: string;
  customerId: string;
  companyId: string;
  assignedToId?: string | null;
  aiEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationRequest {
  customerId: string;
  companyId: string;
  aiEnabled?: boolean;
}

export interface AssignConversationRequest {
  userId: string;
}

export interface ConversationWithDetails {
  id: string;
  customerId: string;
  companyId: string;
  assignedToId?: string | null;
  aiEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  customer: {
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
