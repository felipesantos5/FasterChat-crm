/**
 * ============================================
 * PROMPT INTEGRATION - Integração com AI Service
 * ============================================
 *
 * Helper para integrar o novo sistema modular de prompts
 * com o ai.service.ts existente.
 */

import { buildPrompt, AIObjectiveType, PromptBuildOptions, getObjectiveConfig } from "./index";

interface AIKnowledgeData {
  companyName?: string | null;
  companySegment?: string | null;
  companyDescription?: string | null;
  companyInfo?: string | null;
  objectiveType?: string | null;
  aiObjective?: string | null;
  aiPersonality?: string | null;
  aiCustomInstructions?: string | null;
  workingHours?: string | null;
  businessHoursStart?: number | null;
  businessHoursEnd?: number | null;
  paymentMethods?: string | null;
  deliveryInfo?: string | null;
  serviceArea?: string | null;
  policies?: string | null;
  negativeExamples?: string | null;
  faq?: any;
}

interface CustomerData {
  name: string;
  phone?: string;
  tags?: string[] | null;
  notes?: string | null;
  isGroup?: boolean | null;
}

interface BuildModularPromptOptions {
  companyName: string;
  aiKnowledge: AIKnowledgeData | null;
  customer: CustomerData;
  services?: {
    services: any[];
    zones?: any[];
    combos?: any[];
    additionals?: any[];
  };
  ragContext?: string;
  examplesText?: string;
  feedbackContext?: {
    goodExamples: string[];
    badExamples: string[];
    insights: string[];
  };
  conversationContext?: {
    detectedService?: string;
    recentTopics?: string[];
    intent?: string;
  };
  calendarConnected?: boolean;
}

/**
 * Constrói um prompt usando o sistema modular
 */
export function buildModularPrompt(options: BuildModularPromptOptions): string {
  const { companyName, aiKnowledge, customer, services, ragContext, feedbackContext, conversationContext, calendarConnected } = options;

  // Determina o tipo de objetivo
  let objectiveType: AIObjectiveType = "customer_service";

  if (aiKnowledge?.objectiveType) {
    const validTypes: AIObjectiveType[] = [
      "customer_service",
      "support",
      "sales",
      "sales_scheduling",
      "scheduling",
      "info",
      "custom",
    ];

    if (validTypes.includes(aiKnowledge.objectiveType as AIObjectiveType)) {
      objectiveType = aiKnowledge.objectiveType as AIObjectiveType;
    }
  }

  // Monta o horário de funcionamento
  let workingHours: { start: number; end: number; text?: string } | undefined;

  if (aiKnowledge?.businessHoursStart != null && aiKnowledge?.businessHoursEnd != null) {
    workingHours = {
      start: aiKnowledge.businessHoursStart,
      end: aiKnowledge.businessHoursEnd,
      text: aiKnowledge.workingHours || undefined,
    };
  } else if (aiKnowledge?.workingHours) {
    // Fallback para texto legado
    workingHours = {
      start: 9,
      end: 18,
      text: aiKnowledge.workingHours,
    };
  }

  // Determina customInstructions: sempre inclui aiCustomInstructions independente do tipo
  const customInstructions = aiKnowledge?.aiCustomInstructions ||
    (objectiveType === "custom" ? aiKnowledge?.aiObjective : undefined);

  // Monta as opções do builder
  const buildOptions: PromptBuildOptions = {
    objective: customInstructions
      ? (() => {
          const baseConfig = objectiveType === "custom" && aiKnowledge?.aiObjective
            ? {
                type: "custom" as const,
                name: "Personalizado",
                description: "Objetivo personalizado",
                primaryGoal: aiKnowledge.aiObjective,
                secondaryGoals: [],
                tone: "professional" as const,
                proactivity: "medium" as const,
                closingFocus: false,
                schedulingEnabled: false,
                transferEnabled: true,
              }
            : getObjectiveConfig(objectiveType);
          return { ...baseConfig, customInstructions };
        })()
      : objectiveType,
    company: {
      name: aiKnowledge?.companyName || companyName,
      segment: aiKnowledge?.companySegment || undefined,
      description: aiKnowledge?.companyDescription || aiKnowledge?.companyInfo || undefined,
      workingHours,
      paymentMethods: aiKnowledge?.paymentMethods || undefined,
      deliveryInfo: aiKnowledge?.deliveryInfo || undefined,
      serviceArea: aiKnowledge?.serviceArea || undefined,
      policies: aiKnowledge?.policies || undefined,
    },
    customer: {
      name: customer.name,
      phone: customer.phone,
      tags: customer.tags || undefined,
      notes: customer.notes || undefined,
      isGroup: customer.isGroup || false,
    },
    services: services ? {
      services: services.services || [],
      zones: services.zones,
      combos: services.combos,
      additionals: services.additionals,
    } : undefined,
    knowledge: {
      faq: aiKnowledge?.faq ? (Array.isArray(aiKnowledge.faq) ? aiKnowledge.faq : []) : undefined,
      ragResults: ragContext,
      feedbackLearning: feedbackContext,
      conversationContext,
      conversationExamples: options.examplesText || undefined,
    },
    includeTools: objectiveType === "sales_scheduling" || objectiveType === "scheduling" || objectiveType === "support",
    includeTransbordo: true,
  };

  // Constrói o prompt
  const result = buildPrompt(buildOptions);

  // Adiciona informações extras que o sistema modular ainda não cobre
  let finalPrompt = result.systemPrompt;

  // Adiciona restrições específicas se houver
  if (aiKnowledge?.negativeExamples) {
    finalPrompt += `\n\n### RESTRIÇÕES ESPECÍFICAS DA EMPRESA\n${aiKnowledge.negativeExamples}`;
  }

  // Adiciona status do calendário
  if (calendarConnected !== undefined) {
    const status = calendarConnected ? "conectado e sincronizado" : "não conectado";
    finalPrompt += `\n\n### STATUS DO SISTEMA\nGoogle Calendar: ${status}`;
  }

  return finalPrompt;
}

/**
 * Verifica se deve usar o sistema modular de prompts
 * Por enquanto, usa o sistema modular quando:
 * - Há um objectiveType definido no aiKnowledge
 * - A feature flag USE_MODULAR_PROMPTS está ativa
 */
export function shouldUseModularPrompts(aiKnowledge: AIKnowledgeData | null): boolean {
  // Feature flag via variável de ambiente
  const featureFlag = process.env.USE_MODULAR_PROMPTS === "true";

  if (featureFlag) {
    return true;
  }

  // Usa modular se tem objectiveType definido e diferente do default
  if (aiKnowledge?.objectiveType && aiKnowledge.objectiveType !== "support") {
    return true;
  }

  return false;
}

/**
 * Lista os tipos de objetivo disponíveis para configuração
 */
export function getAvailableObjectiveTypes(): Array<{
  value: string;
  label: string;
  description: string;
}> {
  return [
    {
      value: "customer_service",
      label: "Atendimento ao Cliente",
      description: "IA focada em atender clientes, tirar dúvidas e fornecer informações gerais",
    },
    {
      value: "support",
      label: "Suporte Técnico",
      description: "IA focada em suporte técnico, diagnóstico e resolução de problemas",
    },
    {
      value: "sales",
      label: "Vendas",
      description: "IA focada em vendas, apresentação de produtos e conversão",
    },
    {
      value: "sales_scheduling",
      label: "Vendas + Agendamento",
      description: "IA focada em vendas e agendamento de serviços",
    },
    {
      value: "scheduling",
      label: "Apenas Agendamento",
      description: "IA focada em agendar serviços de forma rápida e eficiente",
    },
    {
      value: "info",
      label: "Apenas Informações",
      description: "IA focada em fornecer informações, sem foco em vendas",
    },
    {
      value: "custom",
      label: "Personalizado",
      description: "Defina suas próprias instruções para a IA",
    },
  ];
}
