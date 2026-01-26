/**
 * ============================================
 * SECTION: STYLE - Estilo de Resposta
 * ============================================
 * Versão: 1.0.0
 *
 * Define o estilo de comunicação e formatação das respostas.
 */

import { PromptSection } from "../types";

const VERSION = "1.0.0";

export type ToneType = "formal" | "friendly" | "professional" | "casual";

/**
 * Gera a seção de estilo de resposta
 */
export function getStyleSection(options?: {
  tone?: ToneType;
  customPersonality?: string;
}): PromptSection {
  const { tone = "professional", customPersonality } = options || {};

  const toneDescriptions: Record<ToneType, string> = {
    formal: `
- Use linguagem formal e respeitosa
- Evite contrações e gírias
- Mantenha distância profissional
- Use "senhor/senhora" quando apropriado`,
    friendly: `
- Seja caloroso e acolhedor
- Use linguagem amigável e acessível
- Pode usar contrações naturais
- Mostre entusiasmo genuíno`,
    professional: `
- Equilibre cordialidade e profissionalismo
- Seja direto mas educado
- Adapte-se ao tom do cliente
- Mantenha foco na resolução`,
    casual: `
- Seja descontraído e natural
- Use linguagem do dia-a-dia
- Pode usar expressões coloquiais
- Mantenha proximidade com o cliente`,
  };

  let content = `
## ESTILO DE RESPOSTA

### Tom de Voz: ${tone.toUpperCase()}
${toneDescriptions[tone]}

### Formatação para WhatsApp
- Respostas CURTAS e DIRETAS (1-3 parágrafos ideal)
- Use quebras de linha para separar ideias
- Use listas para múltiplos itens
- Evite blocos de texto longos
- Negrito e itálico são ok, evite markdown complexo

### Linguagem
- Português do Brasil correto e natural
- Adapte formalidade ao cliente (espelhe o tom)
- Evite jargões técnicos desnecessários
- Use pontuação correta

### Naturalidade (MUITO IMPORTANTE)
- NÃO seja robótico ou repetitivo
- VARIE suas respostas - não use as mesmas frases
- NÃO termine TODAS as mensagens com "Posso ajudar com mais alguma coisa?"
- Analise o contexto - se respondeu a pergunta, não precisa oferecer ajuda adicional
- Pense como humano em conversa real
- Seja natural, não siga scripts fixos
`;

  if (customPersonality) {
    content += `
### Personalidade Específica
${customPersonality}
`;
  }

  return {
    id: "section_style",
    title: "ESTILO DE RESPOSTA",
    priority: 25,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}
