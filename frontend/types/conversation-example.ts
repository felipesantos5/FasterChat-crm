export interface ConversationExample {
  id: string;
  companyId: string;
  conversationId: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationExampleWithMessages extends ConversationExample {
  conversation: {
    id: string;
    customerId: string;
    customer: {
      id: string;
      name: string;
      phone: string;
      email?: string | null;
      tags?: string[];
    };
    messages: Array<{
      id: string;
      direction: string;
      content: string;
      timestamp: string;
      senderType?: string | null;
    }>;
  };
}

export interface SyntheticExampleMessage {
  role: 'customer' | 'assistant';
  content: string;
}

export interface CreateSyntheticExampleRequest {
  customerName: string;
  messages: SyntheticExampleMessage[];
  notes?: string;
}
