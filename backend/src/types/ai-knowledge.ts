export interface AIKnowledgeData {
  id: string;
  companyId: string;
  companyInfo?: string | null;
  productsServices?: string | null;
  toneInstructions?: string | null;
  policies?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateAIKnowledgeRequest {
  companyInfo?: string;
  productsServices?: string;
  toneInstructions?: string;
  policies?: string;
}
