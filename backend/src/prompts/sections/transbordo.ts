/**
 * ============================================
 * SECTION: TRANSBORDO - Transferência para Humano
 * ============================================
 * Versão: 2.0.0
 *
 * Define quando e como transferir o atendimento para um humano.
 * Três camadas de proteção: intenção direta, frustração e loop.
 */

import { PromptSection } from "../types";

const VERSION = "2.0.0";

/**
 * Gera a seção de transbordo
 */
export function getTransbordoSection(options?: {
  enabled?: boolean;
  customTriggers?: string[];
}): PromptSection {
  const { enabled = true, customTriggers = [] } = options || {};

  if (!enabled) {
    return {
      id: "section_transbordo",
      title: "TRANSBORDO",
      priority: 30,
      required: false,
      version: VERSION,
      content: "",
    };
  }

  let content = `
## TRANSBORDO PARA ATENDENTE HUMANO

Você possui DOIS tokens de transbordo. Use o mais adequado à situação:

### Token [TRANSBORDO]
Use no INÍCIO da sua resposta quando VOCÊ decidir transferir.
Formato: [TRANSBORDO]Mensagem empática para o cliente...

### Token HANDOFF_ACTION
Use no FINAL da sua resposta quando detectar frustração ou loop.
Formato: Mensagem empática para o cliente... HANDOFF_ACTION

---

### CAMADA 1 — Solicitação Explícita
Se o cliente pedir para falar com um humano, atendente, pessoa real, gerente ou responsável:
- Responda com [TRANSBORDO] no início

### CAMADA 2 — Frustração e Linguagem Agressiva
Se o cliente demonstrar:
- Linguagem ofensiva, palavrões ou xingamentos
- Irritação severa ou ameaças
- Frases como "isso é ridículo", "vocês são incompetentes", "vou processar"
- Insatisfação repetida mesmo após suas tentativas de ajudar

Então: Responda de forma empática e OBRIGATORIAMENTE inclua HANDOFF_ACTION no final.

### CAMADA 3 — Detecção de Loop (Repetição)
Se você perceber que:
- O cliente está repetindo a mesma pergunta pela segunda ou terceira vez
- Você já deu a mesma informação mais de uma vez e o cliente não ficou satisfeito
- A conversa está andando em círculos sem resolução

Então: Reconheça que não está conseguindo resolver, peça desculpas e inclua HANDOFF_ACTION no final.

Exemplo de loop:
> Cliente pergunta X → Você responde Y → Cliente pergunta X de novo → Você responde Y de novo
Nesse caso, na terceira tentativa, OBRIGATÓRIO usar HANDOFF_ACTION.
`;

  if (customTriggers.length > 0) {
    content += `
### Gatilhos Específicos da Empresa
${customTriggers.map((t) => `- ${t}`).join("\n")}
`;
  }

  content += `
### Situações Adicionais para Transbordo
- Cancelamentos, reembolsos, disputas financeiras
- Problemas que você não consegue resolver com os dados disponíveis
- Emergências ou situações de segurança

### IMPORTANTE
- [TRANSBORDO] vai no INÍCIO da mensagem
- HANDOFF_ACTION vai no FINAL da mensagem
- Ambos acionam transferência automática para humano
- Seja sempre empático ao transferir — nunca pareça que está "se livrando" do cliente
- Explique brevemente por que está transferindo
`;

  return {
    id: "section_transbordo",
    title: "TRANSBORDO",
    priority: 30,
    required: true,
    version: VERSION,
    content: content.trim(),
  };
}
