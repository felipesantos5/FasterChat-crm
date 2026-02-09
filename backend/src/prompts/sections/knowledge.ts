/**
 * ============================================
 * SECTION: KNOWLEDGE - Conhecimento Adicional
 * ============================================
 * Versão: 1.0.0
 *
 * Formata FAQ, RAG, feedback learning e contexto de conversa.
 */

import { PromptSection, KnowledgeContext, CustomerContext } from "../types";

const VERSION = "1.0.0";

/**
 * Gera a seção de exemplos de conversas (Few-shot learning)
 */
export function getConversationExamplesSection(examples?: string): PromptSection {
  if (!examples || examples.trim() === "") {
    return {
      id: "section_conversation_examples",
      title: "EXEMPLOS",
      priority: 15,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  return {
    id: "section_conversation_examples",
    title: "EXEMPLOS DE CONVERSAS",
    priority: 15,
    required: false,
    version: VERSION,
    content: `## EXEMPLOS DE CONVERSAS IDEAIS\n\nEstude os exemplos abaixo e siga o MESMO estilo, tom e abordagem nas suas respostas:\n\n${examples}\n\n**IMPORTANTE:** Use estes exemplos como referência de estilo e abordagem. Adapte o conteúdo para cada situação real.`,
  };
}

/**
 * Gera a seção de FAQ
 */
export function getFAQSection(faq?: Array<{ question: string; answer: string }>): PromptSection {
  if (!faq || faq.length === 0) {
    return {
      id: "section_faq",
      title: "FAQ",
      priority: 16,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## PERGUNTAS FREQUENTES (FAQ)\n\n`;

  for (const item of faq) {
    content += `**P:** ${item.question}\n`;
    content += `**R:** ${item.answer}\n\n`;
  }

  return {
    id: "section_faq",
    title: "FAQ",
    priority: 16,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}

/**
 * Gera a seção de conhecimento RAG
 */
export function getRAGSection(ragResults?: string): PromptSection {
  if (!ragResults || ragResults.trim() === "") {
    return {
      id: "section_rag",
      title: "CONHECIMENTO ADICIONAL",
      priority: 17,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  return {
    id: "section_rag",
    title: "CONHECIMENTO ADICIONAL",
    priority: 17,
    required: false,
    version: VERSION,
    content: `## CONHECIMENTO RELEVANTE\n\nInformações da base de conhecimento que podem ser úteis:\n\n${ragResults}`,
  };
}

/**
 * Gera a seção de aprendizado por feedback
 */
export function getFeedbackLearningSection(
  feedbackLearning?: { goodExamples: string[]; badExamples: string[]; insights: string[] }
): PromptSection {
  if (!feedbackLearning) {
    return {
      id: "section_feedback_learning",
      title: "APRENDIZADO",
      priority: 18,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## APRENDIZADO DE ATENDIMENTOS ANTERIORES\n\n`;

  if (feedbackLearning.goodExamples && feedbackLearning.goodExamples.length > 0) {
    content += `### Exemplos do que FAZER BEM:\n`;
    for (const example of feedbackLearning.goodExamples) {
      content += `- ${example}\n`;
    }
    content += `\n`;
  }

  if (feedbackLearning.badExamples && feedbackLearning.badExamples.length > 0) {
    content += `### Exemplos do que EVITAR:\n`;
    for (const example of feedbackLearning.badExamples) {
      content += `- ${example}\n`;
    }
    content += `\n`;
  }

  if (feedbackLearning.insights && feedbackLearning.insights.length > 0) {
    content += `### Insights Aprendidos:\n`;
    for (const insight of feedbackLearning.insights) {
      content += `- ${insight}\n`;
    }
  }

  return {
    id: "section_feedback_learning",
    title: "APRENDIZADO",
    priority: 18,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}

/**
 * Gera a seção de contexto da conversa atual
 */
export function getConversationContextSection(
  context?: KnowledgeContext["conversationContext"]
): PromptSection {
  if (!context) {
    return {
      id: "section_conversation_context",
      title: "CONTEXTO DA CONVERSA",
      priority: 19,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## CONTEXTO DA CONVERSA ATUAL\n\n`;

  if (context.detectedService) {
    content += `**Serviço de interesse detectado:** ${context.detectedService}\n`;
  }

  if (context.intent) {
    const intentLabels: Record<string, string> = {
      scheduling: "Agendamento",
      information: "Busca de informações",
      pricing: "Consulta de preços",
      comparison: "Comparação de opções",
      support: "Suporte/Problema",
      complaint: "Reclamação",
    };
    content += `**Intenção detectada:** ${intentLabels[context.intent] || context.intent}\n`;
  }

  if (context.recentTopics && context.recentTopics.length > 0) {
    content += `**Tópicos recentes:** ${context.recentTopics.join(", ")}\n`;
  }

  return {
    id: "section_conversation_context",
    title: "CONTEXTO DA CONVERSA",
    priority: 19,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}

/**
 * Gera a seção de dados do cliente atual
 */
export function getCustomerContextSection(customer?: CustomerContext): PromptSection {
  if (!customer) {
    return {
      id: "section_customer",
      title: "CLIENTE ATUAL",
      priority: 8,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `## CLIENTE ATUAL\n\n`;
  content += `**Nome:** ${customer.name}\n`;

  if (customer.tags && customer.tags.length > 0) {
    content += `**Tags:** ${customer.tags.join(", ")}\n`;
  }

  if (customer.notes) {
    content += `**Notas:** ${customer.notes}\n`;
  }

  if (customer.isGroup) {
    content += `**Tipo:** Grupo do WhatsApp\n`;
  }

  return {
    id: "section_customer",
    title: "CLIENTE ATUAL",
    priority: 8,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}
