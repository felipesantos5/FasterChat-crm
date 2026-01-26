/**
 * ============================================
 * SECTION: TOOLS - Ferramentas da IA
 * ============================================
 * Versão: 1.0.0
 *
 * Define as instruções sobre uso de ferramentas (function calling).
 */

import { PromptSection } from "../types";

const VERSION = "1.0.0";

/**
 * Gera a seção de ferramentas disponíveis
 */
export function getToolsSection(options?: {
  schedulingEnabled?: boolean;
  calendarConnected?: boolean;
}): PromptSection {
  const { schedulingEnabled = true, calendarConnected = false } = options || {};

  let content = `
## FERRAMENTAS DISPONÍVEIS

### REGRAS ABSOLUTAS SOBRE FERRAMENTAS
- NUNCA escreva código (Python, JavaScript, etc.) nas suas respostas
- NUNCA use sintaxe como "print()", "get_available_slots()" ou similar no texto
- As ferramentas são executadas AUTOMATICAMENTE pelo sistema
- Você apenas PENSA em usar a ferramenta e o sistema a executa
- Sempre responda em linguagem natural ao cliente

### Ferramentas Disponíveis

#### 1. get_product_info
**Quando usar:** Cliente pergunta sobre produto, serviço, preço ou detalhes
**O que faz:** Busca informações completas sobre produtos/serviços
**Retorna:** Nome, preço, variações, descrição completa
**IMPORTANTE:** Use ANTES de responder sobre produtos para garantir dados corretos
`;

  if (schedulingEnabled) {
    content += `
#### 2. get_available_slots
**Quando usar:** Cliente quer agendar ou pergunta sobre disponibilidade
**O que faz:** Busca horários REAIS disponíveis na agenda
**Retorna:** Lista de horários disponíveis para a data
**Status do Calendário:** ${calendarConnected ? "CONECTADO" : "NÃO CONECTADO"}
${!calendarConnected ? "⚠️ Calendário não conectado - informe que agendamento não está disponível no momento" : ""}

#### 3. create_appointment
**Quando usar:** Após coletar TODOS os dados e cliente CONFIRMAR
**O que faz:** Cria o agendamento no calendário
**Dados obrigatórios:**
- Serviço escolhido
- Data
- Horário
- Endereço COMPLETO (com número - OBRIGATÓRIO)

### Fluxo de Agendamento (quando habilitado)
1. Cliente demonstra interesse → Pergunte serviço e preferência de data
2. Recebe preferência → Use \`get_available_slots\` para buscar horários
3. Cliente escolhe horário → Peça endereço COMPLETO (número é obrigatório!)
4. Tem todos os dados → CONFIRME tudo antes de agendar
5. Cliente confirma → Use \`create_appointment\`

### ⚠️ CRÍTICO: Endereço
- NUNCA invente números de endereço
- NUNCA use "s/n", "1", ou números fictícios
- Se o cliente não fornecer número, PERGUNTE
- Endereço incompleto = NÃO agendar
`;
  }

  return {
    id: "section_tools",
    title: "FERRAMENTAS",
    priority: 15,
    required: schedulingEnabled,
    version: VERSION,
    content: content.trim(),
  };
}
