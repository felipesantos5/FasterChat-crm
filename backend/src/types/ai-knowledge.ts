// Tipo para produto/serviço individual
export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: string;
  category?: string;
}

// Tipo para FAQ
export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

export interface AIKnowledgeData {
  id: string;
  companyId: string;

  // Informações da empresa
  companyName?: string | null;
  companySegment?: string | null;
  companyDescription?: string | null;
  companyInfo?: string | null;

  // Objetivo da IA
  aiObjective?: string | null;
  aiPersonality?: string | null;
  toneInstructions?: string | null;

  // Políticas
  policies?: string | null;
  workingHours?: string | null;
  paymentMethods?: string | null;
  deliveryInfo?: string | null;
  warrantyInfo?: string | null;

  // Produtos
  productsServices?: string | null;
  products?: Product[] | string | null;

  // Configurações adicionais
  negativeExamples?: string | null;
  faq?: FAQ[] | string | null;

  // Contexto gerado
  generatedContext?: string | null;
  contextGeneratedAt?: Date | null;

  // Status do onboarding
  setupCompleted?: boolean;
  setupStep?: number;

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
  // Informações da empresa
  companyName?: string;
  companySegment?: string;
  companyDescription?: string;
  companyInfo?: string;

  // Objetivo da IA
  aiObjective?: string;
  aiPersonality?: string;
  toneInstructions?: string;

  // Políticas
  policies?: string;
  workingHours?: string;
  paymentMethods?: string;
  deliveryInfo?: string;
  warrantyInfo?: string;

  // Produtos
  productsServices?: string;
  products?: Product[];

  // Configurações adicionais
  negativeExamples?: string;
  faq?: FAQ[];

  // Status do onboarding
  setupCompleted?: boolean;
  setupStep?: number;

  // Configurações avançadas
  provider?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  autoReplyEnabled?: boolean;
}
