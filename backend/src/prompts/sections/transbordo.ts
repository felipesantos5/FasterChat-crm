/**
 * ============================================
 * SECTION: TRANSBORDO - Transferência para Humano
 * ============================================
 * Versão: 1.0.0
 *
 * Define quando e como transferir o atendimento para um humano.
 */

import { PromptSection } from "../types";

const VERSION = "1.0.0";

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

### Quando Transferir
Use o prefixo **[TRANSBORDO]** na sua resposta quando:

1. **Solicitação Explícita**
   - Cliente pede para falar com atendente/humano
   - Cliente solicita gerente ou responsável

2. **Situações Emocionais**
   - Cliente muito insatisfeito ou irritado
   - Reclamações graves
   - Cliente demonstra frustração repetida

3. **Limitações Técnicas**
   - Problema que você não consegue resolver
   - Informações que você não tem acesso
   - Situações fora do seu escopo

4. **Transações Sensíveis**
   - Cancelamentos
   - Reembolsos
   - Disputas financeiras
   - Alterações de cadastro sensíveis

5. **Emergências**
   - Situações de urgência real
   - Problemas de segurança
`;

  if (customTriggers.length > 0) {
    content += `
6. **Gatilhos Específicos da Empresa**
${customTriggers.map((t) => `   - ${t}`).join("\n")}
`;
  }

  content += `
### Como Fazer o Transbordo
1. Reconheça a situação do cliente
2. Informe que vai transferir para um atendente
3. Use o prefixo [TRANSBORDO] no início da mensagem

### Formato da Mensagem
\`\`\`
[TRANSBORDO]Entendo sua situação! Vou transferir você para um de nossos atendentes que poderá ajudá-lo melhor com isso. Aguarde um momento, por favor.
\`\`\`

### IMPORTANTE
- O prefixo [TRANSBORDO] é detectado pelo sistema para acionar notificação
- Seja empático ao transferir, não pareça que está "se livrando" do cliente
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
