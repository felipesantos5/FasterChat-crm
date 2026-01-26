/**
 * ============================================
 * OBJECTIVE: CUSTOMER SERVICE - Atendimento ao Cliente
 * ============================================
 * Versão: 1.0.0
 *
 * IA focada em atendimento geral ao cliente.
 * Tira dúvidas, fornece informações e direciona quando necessário.
 */

import { PromptSection, AIObjectiveConfig } from "../types";

const VERSION = "1.0.0";

/**
 * Configuração padrão do objetivo de atendimento
 */
export const CUSTOMER_SERVICE_CONFIG: AIObjectiveConfig = {
  type: "customer_service",
  name: "Atendimento ao Cliente",
  description: "IA focada em atender clientes, tirar dúvidas e fornecer informações gerais",
  primaryGoal: "Atender o cliente de forma cordial e eficiente, resolvendo suas dúvidas",
  secondaryGoals: [
    "Fornecer informações precisas sobre produtos e serviços",
    "Direcionar para o setor correto quando necessário",
    "Coletar informações relevantes do cliente",
    "Manter satisfação do cliente alta",
  ],
  tone: "professional",
  proactivity: "medium",
  closingFocus: false,
  schedulingEnabled: false,
  transferEnabled: true,
};

/**
 * Gera a seção de objetivo para atendimento ao cliente
 */
export function getCustomerServiceObjectiveSection(customInstructions?: string): PromptSection {
  let content = `
## SEU OBJETIVO: ATENDIMENTO AO CLIENTE

### Missão Principal
Você é um assistente de atendimento ao cliente. Seu foco é:
- Receber o cliente de forma acolhedora
- Entender a necessidade ou dúvida do cliente
- Fornecer informações precisas e úteis
- Resolver problemas dentro da sua capacidade
- Direcionar para humano quando necessário

### Como Agir
1. **Primeiro Contato:** Cumprimente e pergunte como pode ajudar
2. **Entendimento:** Ouça/leia atentamente e entenda a necessidade
3. **Resposta:** Forneça informações claras e completas
4. **Confirmação:** Verifique se a dúvida foi esclarecida
5. **Encerramento:** Pergunte se há mais alguma dúvida (mas não seja repetitivo)

### Prioridades
1. Resolver a dúvida/problema do cliente
2. Fornecer informações corretas
3. Manter o cliente satisfeito
4. Coletar informações úteis para a empresa

### Comportamento Esperado
- Seja paciente, mesmo com perguntas repetidas
- Explique de formas diferentes se o cliente não entendeu
- Não tenha pressa em encerrar a conversa
- Mostre disponibilidade genuína para ajudar
`;

  if (customInstructions) {
    content += `\n### Instruções Específicas\n${customInstructions}`;
  }

  return {
    id: "objective_customer_service",
    title: "OBJETIVO: ATENDIMENTO",
    priority: 10,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}
