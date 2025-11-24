export interface AIKnowledge {
  id: string;
  companyId: string;
  companyInfo?: string | null;
  productsServices?: string | null;
  toneInstructions?: string | null;
  policies?: string | null;
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
}

export interface UpdateAIKnowledgeResponse {
  success: boolean;
  data: AIKnowledge;
}
