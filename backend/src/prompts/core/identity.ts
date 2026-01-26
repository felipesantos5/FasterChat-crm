/**
 * ============================================
 * CORE: IDENTITY - Identidade do Assistente
 * ============================================
 * Versão: 1.0.0
 *
 * Define a identidade e contexto do assistente virtual.
 */

import { PromptSection, CompanyContext } from "../types";

const VERSION = "1.0.0";

/**
 * Gera a seção de identidade do assistente
 */
export function getIdentitySection(company: CompanyContext): PromptSection {
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let content = `
## IDENTIDADE

Você é o **Assistente Virtual Oficial da ${company.name}**.
Data atual: ${currentDate}

### Sobre a Empresa
- **Nome:** ${company.name}
`;

  if (company.segment) {
    content += `- **Segmento:** ${company.segment}\n`;
  }

  if (company.description) {
    content += `- **Descrição:** ${company.description}\n`;
  }

  content += `
### Seu Papel
- Você representa a empresa em atendimentos via WhatsApp
- Aja como um funcionário experiente e prestativo
- Seu objetivo é ajudar o cliente da melhor forma possível
- Mantenha a imagem profissional da empresa em todas as interações
`;

  return {
    id: "core_identity",
    title: "IDENTIDADE DO ASSISTENTE",
    priority: 2,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}

/**
 * Gera informações operacionais da empresa
 */
export function getOperationalInfoSection(company: CompanyContext): PromptSection {
  let content = `## INFORMAÇÕES OPERACIONAIS\n\n`;

  // Horário de funcionamento (sempre incluir)
  if (company.workingHours) {
    if (company.workingHours.text) {
      content += `### Horário de Funcionamento\n${company.workingHours.text}\n\n`;
    } else if (company.workingHours.start !== undefined && company.workingHours.end !== undefined) {
      content += `### Horário de Funcionamento\nDas ${company.workingHours.start}h às ${company.workingHours.end}h\n\n`;
    }
  }

  if (company.paymentMethods) {
    content += `### Formas de Pagamento\n${company.paymentMethods}\n\n`;
  }

  if (company.deliveryInfo) {
    content += `### Entrega e Prazos\n${company.deliveryInfo}\n\n`;
  }

  if (company.serviceArea) {
    content += `### Área de Atendimento\n${company.serviceArea}\n\n`;
  }

  if (company.policies) {
    content += `### Políticas\n${company.policies}\n\n`;
  }

  return {
    id: "core_operational",
    title: "INFORMAÇÕES OPERACIONAIS",
    priority: 5,
    required: false,
    version: VERSION,
    content: content.trim(),
  };
}
