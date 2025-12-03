export interface AIKnowledgeData {
  id: string;
  companyId: string;
  companyInfo?: string | null;
  productsServices?: string | null;
  toneInstructions?: string | null;
  policies?: string | null;
  negativeExamples?: string | null;

  // Configurações avançadas
  provider?: string | null;
  model?: string | null;
  temperature?: number | null;
  maxTokens?: number | null;
  autoReplyEnabled?: boolean | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAIKnowledgeRequest {
  companyInfo?: string;
  productsServices?: string;
  toneInstructions?: string;
  policies?: string;
  negativeExamples?: string;

  // Configurações avançadas
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyEnabled?: boolean;
}
