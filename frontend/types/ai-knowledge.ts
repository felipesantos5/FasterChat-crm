// Tipo para produto/serviço individual
export interface Product {
  id: string;
  name: string;
  description?: string;
  price?: string;
  category?: string;
  duration?: number; // Duração em minutos (para serviços)
  salesLink?: string; // Link de venda/checkout (para produtos virtuais, mensalidades, etc.)
}

// Tipo para FAQ
export interface FAQ {
  id: string;
  question: string;
  answer: string;
}

// Tipo para objetivo pré-definido
export interface ObjectivePreset {
  id: string;
  label: string;
  description: string;
  icon?: string;
}

export interface AIKnowledge {
  id: string;
  companyId: string;

  // Informações da empresa
  companyName?: string | null;
  companySegment?: string | null;
  companyDescription?: string | null;
  companyInfo?: string | null; // legado

  // Objetivo da IA
  objectiveType?: string | null; // ID do objetivo pré-definido
  aiObjective?: string | null; // Texto customizado (quando objectiveType = 'custom')
  aiPersonality?: string | null;
  toneInstructions?: string | null; // legado
  
  // Configurações avançadas do objetivo
  aiTone?: string | null; // professional, friendly, casual, formal
  aiProactivity?: string | null; // low, medium, high
  aiClosingFocus?: boolean | null; // Se deve tentar fechar venda
  aiCustomInstructions?: string | null; // Instruções personalizadas adicionais

  // Políticas
  policies?: string | null;
  workingHours?: string | null; // texto legado
  businessHoursStart?: number | null; // hora de início (0-23)
  businessHoursEnd?: number | null; // hora de fim (0-23)
  paymentMethods?: string | null;
  deliveryInfo?: string | null;
  warrantyInfo?: string | null;

  // Produtos e Serviços
  productsServices?: string | null; // legado
  products?: Product[];

  // Configurações adicionais
  negativeExamples?: string | null;
  faq?: FAQ[];

  // Contexto gerado
  generatedContext?: string | null;
  contextGeneratedAt?: string | null;

  // Status do onboarding
  setupCompleted?: boolean;
  setupStep?: number;

  // Configurações avançadas (internas)
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

  // Informações da empresa
  companyName?: string;
  companySegment?: string;
  companyDescription?: string;
  companyInfo?: string;

  // Objetivo da IA
  objectiveType?: string; // ID do objetivo pré-definido
  aiObjective?: string; // Texto customizado (quando objectiveType = 'custom')
  aiPersonality?: string;
  toneInstructions?: string;
  
  // Configurações avançadas do objetivo
  aiTone?: string; // professional, friendly, casual, formal
  aiProactivity?: string; // low, medium, high
  aiClosingFocus?: boolean; // Se deve tentar fechar venda
  aiCustomInstructions?: string; // Instruções personalizadas adicionais

  // Políticas
  policies?: string;
  workingHours?: string; // texto legado
  businessHoursStart?: number; // hora de início (0-23)
  businessHoursEnd?: number; // hora de fim (0-23)
  paymentMethods?: string;
  deliveryInfo?: string;
  warrantyInfo?: string;

  // Produtos e Serviços
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

export interface UpdateAIKnowledgeResponse {
  success: boolean;
  data: AIKnowledge;
}

export interface GenerateContextRequest {
  companyId: string;
}

export interface GenerateContextResponse {
  success: boolean;
  data: {
    generatedContext: string;
    contextGeneratedAt: string;
  };
}

export interface GetObjectivePresetsResponse {
  success: boolean;
  data: ObjectivePreset[];
}
