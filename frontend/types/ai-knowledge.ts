export interface AIKnowledge {
  id: string;
  companyId: string;
  companyInfo?: string | null;
  productsServices?: string | null;
  toneInstructions?: string | null;
  policies?: string | null;

  // Configurações avançadas
  provider?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  autoReplyEnabled?: boolean | null;

  createdAt: string;
  updatedAt: string;
}

export interface GetAIKnowledgeResponse {
  success: boolean;
  data: AIKnowledge | null;
}

export interface UpdateAIKnowledgeRequest {
  companyId: string;
  companyInfo?: string;
  productsServices?: string;
  toneInstructions?: string;
  policies?: string;

  // Configurações avançadas
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyEnabled?: boolean;
}

export interface UpdateAIKnowledgeResponse {
  success: boolean;
  data: AIKnowledge;
}
