/**
 * ============================================
 * OBJECTIVES - Módulos de Objetivos da IA
 * ============================================
 *
 * Cada objetivo define o comportamento e foco da IA:
 * - customer_service: Atendimento geral
 * - support: Suporte técnico
 * - sales: Vendas
 * - sales_scheduling: Vendas + Agendamento
 * - scheduling: Apenas agendamento
 * - info: Apenas informações
 */

import { AIObjectiveType, AIObjectiveConfig, PromptSection } from "../types";

// Exporta os módulos individuais
export * from "./customer-service";
export * from "./support";
export * from "./sales";
export * from "./sales-scheduling";
export * from "./scheduling";
export * from "./info";

// Importa as configurações
import { CUSTOMER_SERVICE_CONFIG, getCustomerServiceObjectiveSection } from "./customer-service";
import { SUPPORT_CONFIG, getSupportObjectiveSection } from "./support";
import { SALES_CONFIG, getSalesObjectiveSection } from "./sales";
import { SALES_SCHEDULING_CONFIG, getSalesSchedulingObjectiveSection } from "./sales-scheduling";
import { SCHEDULING_CONFIG, getSchedulingObjectiveSection } from "./scheduling";
import { INFO_CONFIG, getInfoObjectiveSection } from "./info";

/**
 * Mapa de todas as configurações de objetivo
 */
export const OBJECTIVE_CONFIGS: Record<AIObjectiveType, AIObjectiveConfig> = {
  customer_service: CUSTOMER_SERVICE_CONFIG,
  support: SUPPORT_CONFIG,
  sales: SALES_CONFIG,
  sales_scheduling: SALES_SCHEDULING_CONFIG,
  scheduling: SCHEDULING_CONFIG,
  info: INFO_CONFIG,
  custom: {
    type: "custom",
    name: "Personalizado",
    description: "Objetivo personalizado pelo cliente",
    primaryGoal: "",
    secondaryGoals: [],
    tone: "professional",
    proactivity: "medium",
    closingFocus: false,
    schedulingEnabled: false,
    transferEnabled: true,
  },
};

/**
 * Retorna a configuração de um objetivo
 */
export function getObjectiveConfig(type: AIObjectiveType): AIObjectiveConfig {
  return OBJECTIVE_CONFIGS[type] || OBJECTIVE_CONFIGS.customer_service;
}

/**
 * Retorna a seção de prompt para um objetivo específico
 */
export function getObjectiveSection(
  type: AIObjectiveType,
  customInstructions?: string
): PromptSection {
  switch (type) {
    case "customer_service":
      return getCustomerServiceObjectiveSection(customInstructions);
    case "support":
      return getSupportObjectiveSection(customInstructions);
    case "sales":
      return getSalesObjectiveSection(customInstructions);
    case "sales_scheduling":
      return getSalesSchedulingObjectiveSection(customInstructions);
    case "scheduling":
      return getSchedulingObjectiveSection(customInstructions);
    case "info":
      return getInfoObjectiveSection(customInstructions);
    case "custom":
      return getCustomObjectiveSection(customInstructions);
    default:
      return getCustomerServiceObjectiveSection(customInstructions);
  }
}

/**
 * Gera seção para objetivo customizado
 */
function getCustomObjectiveSection(customInstructions?: string): PromptSection {
  return {
    id: "objective_custom",
    title: "OBJETIVO PERSONALIZADO",
    priority: 10,
    required: true,
    version: "1.0.0",
    content: customInstructions || "Atenda o cliente de forma cordial e profissional.",
  };
}

/**
 * Lista todos os objetivos disponíveis para seleção
 */
export function listAvailableObjectives(): Array<{
  type: AIObjectiveType;
  name: string;
  description: string;
}> {
  return Object.values(OBJECTIVE_CONFIGS)
    .filter((config) => config.type !== "custom")
    .map((config) => ({
      type: config.type,
      name: config.name,
      description: config.description,
    }));
}
