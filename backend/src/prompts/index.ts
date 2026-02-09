/**
 * ============================================
 * PROMPT SYSTEM - Sistema Modular de Prompts
 * ============================================
 * Versão: 1.0.0
 *
 * Arquitetura:
 * - core/       -> Módulos base (segurança, identidade, regras)
 * - objectives/ -> Templates por tipo de IA (vendas, suporte, agendamento)
 * - sections/   -> Seções reutilizáveis (tools, style, transbordo)
 *
 * Uso básico:
 * ```typescript
 * import { PromptBuilder, buildPrompt } from './prompts';
 *
 * const result = buildPrompt({
 *   objective: 'sales_scheduling',
 *   company: { name: 'Minha Empresa', segment: 'HVAC' },
 *   services: { services: [...] },
 *   customer: { name: 'João' },
 * });
 *
 * console.log(result.systemPrompt);
 * ```
 */

// Main exports
export { PromptBuilder, buildPrompt } from "./builder";
export { PROMPT_VERSIONS, getCurrentVersion, getVersion, getFullVersionString } from "./versions";
export * from "./types";

// Core modules
export * as CoreModules from "./core";

// Objective modules
export * as ObjectiveModules from "./objectives";
export {
  OBJECTIVE_CONFIGS,
  getObjectiveConfig,
  getObjectiveSection,
  listAvailableObjectives,
} from "./objectives";

// Section modules
export * as SectionModules from "./sections";

// Re-export individual sections for direct access
export { getToolsSection } from "./sections/tools";
export { getStyleSection } from "./sections/style";
export { getTransbordoSection } from "./sections/transbordo";
export { getServicesSection, getAdvancedPricingSection } from "./sections/services";
export {
  getFAQSection,
  getRAGSection,
  getConversationContextSection,
  getCustomerContextSection,
} from "./sections/knowledge";

// Re-export core sections for direct access
export { getSecuritySection, getAntiManipulationRules } from "./core/security";
export { getIdentitySection, getOperationalInfoSection } from "./core/identity";
export {
  getCustomerServiceRulesSection,
  getCommunicationRulesSection,
  getRestrictionsSection,
} from "./core/rules";

// Integration helpers
export {
  buildModularPrompt,
  shouldUseModularPrompts,
  getAvailableObjectiveTypes,
} from "./integration";
