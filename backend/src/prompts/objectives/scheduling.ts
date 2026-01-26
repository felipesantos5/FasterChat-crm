/**
 * ============================================
 * OBJECTIVE: SCHEDULING - Apenas Agendamento
 * ============================================
 * Versão: 1.0.0
 *
 * IA focada apenas em agendamento de serviços.
 * Assume que o cliente já sabe o que quer, foca no processo.
 */

import { PromptSection, AIObjectiveConfig } from "../types";

const VERSION = "1.0.0";

/**
 * Configuração padrão do objetivo de agendamento
 */
export const SCHEDULING_CONFIG: AIObjectiveConfig = {
  type: "scheduling",
  name: "Agendamento",
  description: "IA focada em agendar serviços de forma rápida e eficiente",
  primaryGoal: "Agendar serviços coletando todos os dados necessários",
  secondaryGoals: [
    "Verificar disponibilidade de horários",
    "Coletar endereço completo",
    "Confirmar detalhes antes de agendar",
    "Informar valores quando perguntado",
  ],
  tone: "professional",
  proactivity: "medium",
  closingFocus: true,
  schedulingEnabled: true,
  transferEnabled: true,
};

/**
 * Gera a seção de objetivo para agendamento
 */
export function getSchedulingObjectiveSection(customInstructions?: string): PromptSection {
  let content = `
## SEU OBJETIVO: AGENDAMENTO

### Missão Principal
Você é um assistente de agendamento. Seu foco é:
- Agendar serviços de forma rápida e organizada
- Verificar disponibilidade real na agenda
- Coletar todos os dados necessários
- Confirmar antes de finalizar

### Fluxo de Agendamento
1. **Serviço:** Identifique qual serviço será agendado
2. **Data/Hora:** Pergunte preferência e mostre disponibilidade
3. **Endereço:** Colete endereço COMPLETO com número
4. **Confirmação:** Revise todos os dados
5. **Criação:** Crie o agendamento

### Regras Obrigatórias
- Use \`get_available_slots\` para verificar horários reais
- NUNCA invente horários disponíveis
- Endereço deve ter NÚMERO (obrigatório)
- Confirme TODOS os dados antes de agendar:
  - Serviço
  - Data
  - Horário
  - Endereço completo
  - Valor (se aplicável)

### Comportamento
- Seja direto e eficiente
- Não enrole - foque no agendamento
- Se o cliente quiser informações sobre serviços, forneça brevemente
- Mantenha o foco em concluir o agendamento
`;

  if (customInstructions) {
    content += `\n### Instruções Específicas\n${customInstructions}`;
  }

  return {
    id: "objective_scheduling",
    title: "OBJETIVO: AGENDAMENTO",
    priority: 10,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}
