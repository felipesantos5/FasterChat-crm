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
  objectiveType?: string | null; // ID do objetivo pré-definido
  aiObjective?: string | null; // Texto customizado (quando objectiveType = 'custom')

  // Políticas
  policies?: string | null;
  workingHours?: string | null;
  paymentMethods?: string | null;
  deliveryInfo?: string | null;
  warrantyInfo?: string | null;

  // Área de atendimento
  serviceArea?: string | null;

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

  // Configurações avançadas (apenas provider, model e autoReply são usados)
  provider?: string | null;
  model?: string | null;
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
  objectiveType?: string; // ID do objetivo pré-definido
  aiObjective?: string; // Texto customizado (quando objectiveType = 'custom')

  // Políticas
  policies?: string;
  workingHours?: string;
  paymentMethods?: string;
  deliveryInfo?: string;
  warrantyInfo?: string;

  // Área de atendimento
  serviceArea?: string;

  // Produtos
  productsServices?: string;
  products?: Product[];

  // Configurações adicionais
  negativeExamples?: string;
  faq?: FAQ[];

  // Status do onboarding
  setupCompleted?: boolean;
  setupStep?: number;

  // Configurações avançadas (apenas provider, model e autoReply)
  provider?: string;
  model?: string;
  autoReplyEnabled?: boolean;
}
