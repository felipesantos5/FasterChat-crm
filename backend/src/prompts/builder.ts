/**
 * ============================================
 * PROMPT BUILDER - Construtor de Prompts
 * ============================================
 * Versão: 1.0.0
 *
 * Monta o prompt final combinando todas as seções modulares.
 */

import {
  PromptBuildOptions,
  PromptSection,
  BuiltPrompt,
  AIObjectiveType,
  AIObjectiveConfig,
} from "./types";
import { getCurrentVersion, getFullVersionString } from "./versions";

// Core modules
import { getSecuritySection, getAntiManipulationRules } from "./core/security";
import { getIdentitySection, getOperationalInfoSection } from "./core/identity";
import {
  getCustomerServiceRulesSection,
  getCommunicationRulesSection,
  getRestrictionsSection,
  getConsultativeSalesRulesSection,
} from "./core/rules";

// Objective modules
import { getObjectiveSection, getObjectiveConfig } from "./objectives";

// Section modules
import { getToolsSection } from "./sections/tools";
import { getStyleSection, ToneType } from "./sections/style";
import { getTransbordoSection } from "./sections/transbordo";
import { getServicesSection, getAdvancedPricingSection } from "./sections/services";
import {
  getFAQSection,
  getRAGSection,
  getFeedbackLearningSection,
  getConversationContextSection,
  getCustomerContextSection,
} from "./sections/knowledge";

/**
 * Classe principal para construção de prompts
 */
export class PromptBuilder {
  private sections: PromptSection[] = [];
  private options: PromptBuildOptions;
  private startTime: number;

  constructor(options: PromptBuildOptions) {
    this.options = options;
    this.startTime = Date.now();
  }

  /**
   * Constrói o prompt completo
   */
  build(): BuiltPrompt {
    this.sections = [];

    // Determina o tipo de objetivo
    const objectiveType: AIObjectiveType =
      typeof this.options.objective === "string"
        ? this.options.objective
        : this.options.objective.type;

    const objectiveConfig: AIObjectiveConfig =
      typeof this.options.objective === "string"
        ? getObjectiveConfig(this.options.objective)
        : this.options.objective;

    // 1. CORE: Segurança (sempre primeiro)
    this.addSection(getSecuritySection());

    // 2. CORE: Identidade
    this.addSection(getIdentitySection(this.options.company));

    // 3. CORE: Regras de atendimento
    this.addSection(getCustomerServiceRulesSection());

    // 4. CORE: Regras de comunicação
    this.addSection(getCommunicationRulesSection());

    // 5. CORE: Informações operacionais
    this.addSection(getOperationalInfoSection(this.options.company));

    // 6. Cliente atual
    if (this.options.customer) {
      this.addSection(getCustomerContextSection(this.options.customer));
    }

    // 7. OBJETIVO específico
    this.addSection(
      getObjectiveSection(objectiveType, objectiveConfig.customInstructions)
    );

    // 7.1. Regras de venda consultiva (para objetivos de vendas)
    if (objectiveType === "sales" || objectiveType === "sales_scheduling") {
      this.addSection(getConsultativeSalesRulesSection());
    }

    // 8. Serviços/Produtos
    if (this.options.services) {
      this.addSection(getServicesSection(this.options.services));
      this.addSection(getAdvancedPricingSection(this.options.services));
    }

    // 9. Tools (se habilitado)
    if (this.options.includeTools !== false) {
      this.addSection(
        getToolsSection({
          schedulingEnabled: objectiveConfig.schedulingEnabled,
          calendarConnected: true, // TODO: passar como parâmetro
        })
      );
    }

    // 10. FAQ
    if (this.options.knowledge?.faq) {
      this.addSection(getFAQSection(this.options.knowledge.faq));
    }

    // 11. RAG
    if (this.options.knowledge?.ragResults) {
      this.addSection(getRAGSection(this.options.knowledge.ragResults));
    }

    // 12. Feedback Learning
    if (this.options.knowledge?.feedbackLearning) {
      this.addSection(
        getFeedbackLearningSection(this.options.knowledge.feedbackLearning)
      );
    }

    // 13. Contexto da conversa
    if (this.options.knowledge?.conversationContext) {
      this.addSection(
        getConversationContextSection(this.options.knowledge.conversationContext)
      );
    }

    // 14. Restrições
    this.addSection(getRestrictionsSection());

    // 15. Estilo de resposta
    this.addSection(
      getStyleSection({
        tone: objectiveConfig.tone as ToneType,
      })
    );

    // 16. Transbordo (se habilitado)
    if (this.options.includeTransbordo !== false && objectiveConfig.transferEnabled) {
      this.addSection(getTransbordoSection({ enabled: true }));
    }

    // 17. Seções customizadas
    if (this.options.customSections) {
      for (const section of this.options.customSections) {
        this.addSection(section);
      }
    }

    // Ordena seções por prioridade
    this.sections.sort((a, b) => a.priority - b.priority);

    // Monta o prompt final
    const systemPrompt = this.buildSystemPrompt();
    const buildTime = Date.now() - this.startTime;

    return {
      systemPrompt,
      sections: this.sections,
      version: getCurrentVersion().version,
      objectiveType,
      metadata: {
        totalSections: this.sections.length,
        includedSections: this.sections.map((s) => s.id),
        buildTime,
      },
    };
  }

  /**
   * Adiciona uma seção se tiver conteúdo
   */
  private addSection(section: PromptSection): void {
    if (section.content && section.content.trim() !== "") {
      this.sections.push(section);
    }
  }

  /**
   * Monta o system prompt final
   */
  private buildSystemPrompt(): string {
    const parts: string[] = [];

    // Header com versão
    parts.push(`# SISTEMA DE ATENDIMENTO ${this.options.company.name.toUpperCase()}`);
    parts.push(`<!-- ${getFullVersionString()} -->\n`);

    // Adiciona cada seção
    for (const section of this.sections) {
      parts.push(section.content);
      parts.push(""); // Linha em branco entre seções
    }

    // Adiciona regras anti-manipulação no final
    parts.push(getAntiManipulationRules());

    return parts.join("\n").trim();
  }

  /**
   * Método estático para construção rápida
   */
  static build(options: PromptBuildOptions): BuiltPrompt {
    const builder = new PromptBuilder(options);
    return builder.build();
  }

  /**
   * Método para construir apenas com objetivo e empresa (simplificado)
   */
  static simple(
    objectiveType: AIObjectiveType,
    companyName: string,
    customInstructions?: string
  ): string {
    const result = PromptBuilder.build({
      objective: objectiveType,
      company: { name: companyName },
      includeTools: false,
      includeTransbordo: true,
    });
    return result.systemPrompt;
  }
}

/**
 * Função helper para construir prompt rapidamente
 */
export function buildPrompt(options: PromptBuildOptions): BuiltPrompt {
  return PromptBuilder.build(options);
}
