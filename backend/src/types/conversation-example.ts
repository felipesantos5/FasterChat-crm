export interface ConversationExampleData {
  id: string;
  companyId: string;
  conversationId: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationExampleRequest {
  conversationId: string;
  notes?: string;
}

export interface ConversationExampleWithMessages extends ConversationExampleData {
  conversation: {
    id: string;
    customerId: string;
    customer: {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
    };
    messages: Array<{
      id: string;
      direction: string;
      content: string;
      timestamp: Date;
      senderType?: string | null;
    }>;
  };
}

export interface GetConversationExamplesResponse {
  success: boolean;
  data: ConversationExampleWithMessages[];
}

export interface MarkAsExampleResponse {
  success: boolean;
  data: ConversationExampleData;
}
