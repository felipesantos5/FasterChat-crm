/**
 * ============================================
 * PROMPT TYPES - Tipos do Sistema de Prompts
 * ============================================
 */

/**
 * Tipos de objetivo da IA
 */
export type AIObjectiveType =
  | "customer_service"    // Atendimento geral
  | "support"             // Suporte técnico
  | "sales"               // Vendas
  | "sales_scheduling"    // Vendas + Agendamento
  | "scheduling"          // Apenas agendamento
  | "info"                // Apenas informações
  | "custom";             // Personalizado

/**
 * Configuração de um objetivo
 */
export interface AIObjectiveConfig {
  type: AIObjectiveType;
  name: string;
  description: string;
  primaryGoal: string;
  secondaryGoals: string[];
  tone: "formal" | "friendly" | "professional" | "casual";
  proactivity: "low" | "medium" | "high";
  closingFocus: boolean;         // Foco em fechamento/conversão
  schedulingEnabled: boolean;    // Pode agendar
  transferEnabled: boolean;      // Pode transferir para humano
  customInstructions?: string;   // Instruções extras do cliente
}

/**
 * Contexto da empresa para construção do prompt
 */
export interface CompanyContext {
  name: string;
  segment?: string;
  description?: string;
  workingHours?: {
    start: number;
    end: number;
    text?: string;
  };
  paymentMethods?: string;
  deliveryInfo?: string;
  serviceArea?: string;
  policies?: string;
}

/**
 * Contexto do cliente atual
 */
export interface CustomerContext {
  name: string;
  phone?: string;
  tags?: string[];
  notes?: string;
  isGroup?: boolean;
}

/**
 * Contexto de serviços/produtos
 */
export interface ServicesContext {
  services: any[];
  pricing?: any;
  zones?: any[];
  combos?: any[];
  additionals?: any[];
}

/**
 * Contexto de conhecimento adicional
 */
export interface KnowledgeContext {
  faq?: Array<{ question: string; answer: string }>;
  ragResults?: string;
  feedbackLearning?: {
    goodExamples: string[];
    badExamples: string[];
    insights: string[];
  };
  conversationContext?: {
    detectedService?: string;
    recentTopics?: string[];
    intent?: string;
  };
}

/**
 * Seção do prompt
 */
export interface PromptSection {
  id: string;
  title: string;
  content: string;
  priority: number;       // Ordem de aparição (menor = primeiro)
  required: boolean;      // Obrigatória ou opcional
  version: string;        // Versão da seção
}

/**
 * Resultado da construção do prompt
 */
export interface BuiltPrompt {
  systemPrompt: string;
  sections: PromptSection[];
  version: string;
  objectiveType: AIObjectiveType;
  metadata: {
    totalSections: number;
    includedSections: string[];
    buildTime: number;
  };
}

/**
 * Opções para construção do prompt
 */
export interface PromptBuildOptions {
  objective: AIObjectiveType | AIObjectiveConfig;
  company: CompanyContext;
  customer?: CustomerContext;
  services?: ServicesContext;
  knowledge?: KnowledgeContext;
  includeTools?: boolean;
  includeTransbordo?: boolean;
  customSections?: PromptSection[];
}
