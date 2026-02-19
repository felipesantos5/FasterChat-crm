/**
 * ============================================
 * INTENT SCRIPTS - Scripts de Atendimento por Intenção
 * ============================================
 * Versão: 1.0.0
 *
 * Quando uma intenção específica é detectada na conversa
 * (ex: "INSTALAÇÃO DE AR CONDICIONADO"), um script estruturado
 * é injetado no system prompt, guiando a IA pelas fases corretas.
 *
 * Como funciona:
 * 1. O conversationContextService detecta a intenção do cliente
 * 2. O PromptBuilder injeta a seção correta via getIntentScriptSection()
 * 3. A IA segue o script de perguntas/fases obrigatórias
 *
 * Para adicionar novos scripts: crie um novo IntentScript abaixo
 * e registre-o no mapa INTENT_SCRIPTS.
 */

import { PromptSection } from "../types";

const VERSION = "1.0.0";

// ============================================
// TIPOS
// ============================================

export interface IntentScriptPhase {
  id: string;
  title: string;
  icon: string;       // emoji
  description: string; // o que a IA faz/pergunta nessa fase
  type: "trigger" | "question" | "action" | "output"; // tipo do nó no fluxo
}

export interface IntentScript {
  /** Identificador único da intenção */
  id: string;
  /** Label amigável para logs/debug */
  label: string;
  /** Palavras-chave que ativam este script (usadas na detecção) */
  triggers: string[];
  /** Dados obrigatórios que DEVEM ser coletados antes de avançar */
  requiredData: string[];
  /** Fases do fluxo — usado para renderização visual no admin */
  phases: IntentScriptPhase[];
  /** Gera o conteúdo do script para o system prompt */
  buildPrompt: () => string;
}

// ============================================
// SCRIPT: INSTALAÇÃO DE AR CONDICIONADO
// ============================================

const acInstallationScript: IntentScript = {
  id: "ac_installation",
  label: "Instalação de Ar Condicionado",
  triggers: [
    "instalação", "instalar", "instalação de ar", "ar condicionado instalação",
    "instalar ar condicionado", "instalar split", "instalar ar", "quero instalar",
    "preciso instalar", "instalação split", "instalar aparelho",
  ],
  requiredData: [
    "tipo_equipamento",     // Split, janela, cassete, multi-split
    "capacidade_btus",      // 9.000, 12.000, 18.000, 24.000 BTUs
    "quantidade",           // Quantas unidades
    "tipo_ambiente",        // Quarto, sala, escritório, loja
    "situacao_instalacao",  // Parede alvenaria/drywall, altura, distância condensadora
    "necessidade_eletrica", // Precisa de circuito dedicado?
    "endereco_regiao",      // Bairro/região para verificar cobertura e taxa
  ],
  phases: [
    {
      id: "fase_1",
      title: "Acolhimento & Tipo de Equipamento",
      icon: "👋",
      description: "Confirmar a intenção e identificar o tipo de aparelho: Split, Janela, Cassete ou Multi-Split.",
      type: "trigger",
    },
    {
      id: "fase_2",
      title: "Capacidade (BTUs) & Quantidade",
      icon: "❄️",
      description: "Perguntar os BTUs do aparelho e quantas unidades serão instaladas. Ajudar o cliente se não souber os BTUs.",
      type: "question",
    },
    {
      id: "fase_3",
      title: "Situação Técnica da Instalação",
      icon: "🔧",
      description: "Verificar tipo de parede (alvenaria ou drywall), distância da condensadora e andar/altura.",
      type: "question",
    },
    {
      id: "fase_4",
      title: "Necessidade Elétrica",
      icon: "⚡",
      description: "Verificar se o local já tem circuito dedicado ou se precisa incluir instalação elétrica (serviço adicional).",
      type: "question",
    },
    {
      id: "fase_5",
      title: "Localização / Região",
      icon: "📍",
      description: "Coletar o bairro/região para confirmar cobertura e calcular taxa de deslocamento.",
      type: "question",
    },
    {
      id: "fase_6",
      title: "Apresentação do Orçamento",
      icon: "💰",
      description: "Apresentar o valor detalhado (serviço + elétrica + deslocamento) apenas após coletar todos os dados.",
      type: "output",
    },
    {
      id: "fase_7",
      title: "Agendamento",
      icon: "📅",
      description: "Quando o cliente confirmar interesse, coletar data preferida, endereço completo e criar o agendamento.",
      type: "action",
    },
  ],
  buildPrompt: () => `
## 🚨 SCRIPT ATIVO: INSTALAÇÃO DE AR CONDICIONADO

O cliente demonstrou interesse em **INSTALAÇÃO DE AR CONDICIONADO**.
Ative o roteiro estruturado abaixo. Siga as fases NA ORDEM. Não pule etapas.

---

### REGRA CRÍTICA: UMA PERGUNTA POR VEZ
❌ NUNCA faça mais de 1 pergunta na mesma mensagem.
✅ Colete os dados UM POR UM, de forma conversacional e natural.

---

### ✅ CHECKLIST OBRIGATÓRIO (colete todos antes de apresentar orçamento)
Você PRECISA descobrir:
- [ ] Tipo de equipamento (Split, Janela, Cassete, Multi-Split)
- [ ] Capacidade em BTUs (9.000 / 12.000 / 18.000 / 24.000 /outros)
- [ ] Quantidade de unidades a instalar
- [ ] Tipo de ambiente (quarto, sala, escritório, loja, etc.)
- [ ] Situação da instalação (alvenaria ou drywall? altura do teto? distância da condensadora prevista)
- [ ] Necessidade elétrica (já tem circuito dedicado ou precisa instalar?)
- [ ] Endereço / região (para calcular taxa de deslocamento se houver)

---

### FASE 1 — ACOLHIMENTO E TIPO DE EQUIPAMENTO
**Objetivo:** Confirmar a intenção e identificar o tipo de equipamento.

Exemplo de abertura:
> "Ótimo! Vou te ajudar com a instalação. Pode me dizer qual o tipo de aparelho? Por exemplo: Split (o mais comum, com unidade interna e externa), Janela, Cassete de teto, ou Multi-Split (mais de 1 ambiente)?"

⛔ Não fale de preço ainda.
⛔ Não pergunte BTUs ainda — espere a resposta do tipo primeiro.

---

### FASE 2 — CAPACIDADE (BTUs) E QUANTIDADE
**Objetivo:** Entender o tamanho e quantas unidades.

Depois de saber o tipo, pergunte BTUs:
> "Qual a capacidade do aparelho em BTUs? Por exemplo: 9.000, 12.000, 18.000 ou 24.000 BTUs."

Se o cliente não souber os BTUs:
> "Sem problemas! Me conta: é para um quarto, sala ou outro ambiente? E tem ideia do tamanho em metros quadrados? Assim consigo te orientar sobre a capacidade ideal."

Depois dos BTUs, pergunte quantidade (se não ficou claro):
> "Vai instalar quantos aparelhos?"

---

### FASE 3 — SITUAÇÃO TÉCNICA DA INSTALAÇÃO
**Objetivo:** Entender se há complexidade na instalação que afeta o preço.

Pergunte de forma simples:
> "Para eu calcular certinho, preciso entender a situação da instalação. A parede onde vai fixar a unidade interna é de alvenaria (tijolo/concreto) ou drywall/gesso?"

Depois, pergunte sobre distância:
> "Tem uma ideia de onde ficará a unidade externa (condensadora)? É próxima à unidade interna, no mesmo andar, ou precisaria de uma tubulação longa?"

Se houver andares/altura:
> "A instalação é em qual andar? Pergunto porque alturas maiores podem exigir rapel ou equipamento especial."

---

### FASE 4 — ELÉTRICA
**Objetivo:** Verificar se precisa de serviço elétrico adicional.

> "O local já tem circuito elétrico dedicado para o ar condicionado (tomada específica com disjuntor próprio)? Ou precisaria incluir a instalação elétrica também?"

Se precisar de elétrica — informe que é um serviço adicional com custo separado.

---

### FASE 5 — LOCALIZAÇÃO / REGIÃO
**Objetivo:** Verificar cobertura e calcular taxa de deslocamento (se houver).

> "Qual o bairro ou região onde será feita a instalação?"

Use a região para:
- Confirmar que atende aquela área
- Aplicar taxa de deslocamento (se houver faixas de zona configuradas)

---

### FASE 6 — ORÇAMENTO E APRESENTAÇÃO
**Objetivo:** Apresentar o valor de forma clara APENAS após ter todos os dados.

✅ Só entre nesta fase quando tiver: tipo + BTUs + quantidade + situação + elétrica + região.

Formato de resposta de orçamento:
\`\`\`
Ótimo! Com base nas informações que você me passou, aqui está o orçamento:

📋 Serviço: Instalação de Split [BTUs]
📦 Quantidade: [N] unidade(s)
🏗️ Situação: [alvenaria/drywall, sem/com complexidade]
[se precisar de elétrica] ⚡ Circuito dedicado: incluso / +R$ XX,00

💰 Valor total estimado: R$ [valor]
[se houver taxa de zona] 🚗 Taxa de deslocamento ([bairro]): +R$ [valor]
━━━━━━━━━━━━━━━
Total: R$ [valor final]

Esse valor inclui [o que está incluso: mão de obra, suporte, etc.].
Ficou alguma dúvida? Quer agendar uma visita?
\`\`\`

---

### FASE 7 — AGENDAMENTO (Só quando cliente confirmar interesse)
Sinais de que o cliente quer agendar:
- "quero agendar", "pode marcar", "quando tem disponível", "vamos lá"

Ao identificar interesse:
1. Pergunte preferência de data/horário
2. Use a ferramenta \`get_available_slots\` para verificar agenda
3. Colete o endereço completo com número
4. Confirme TODOS os dados antes de criar o agendamento
5. Use \`create_appointment\` apenas após confirmação explícita

---

### ⚠️ REGRAS GERAIS DESTE SCRIPT
- ❌ Nunca invente preços — use SEMPRE os valores cadastrados no catálogo de serviços
- ❌ Nunca pule para o agendamento sem ter o orçamento aprovado
- ✅ Se o cliente não souber responder uma pergunta técnica, ofereça ajuda: "Sem problema, posso te orientar"
- ✅ Se a região não tiver cobertura, informe educadamente e ofereça alternativas (se houver)
- ✅ Se for complexo (rapel, altura elevada, drywall), informe que pode exigir vistoria prévia
`.trim(),
};

// ============================================
// SCRIPT: MANUTENÇÃO DE AR CONDICIONADO
// ============================================

const acMaintenanceScript: IntentScript = {
  id: "ac_maintenance",
  label: "Manutenção de Ar Condicionado",
  triggers: [
    "manutenção", "manutencao", "manutenção de ar", "revisão", "revisao",
    "checar ar condicionado", "verificar ar condicionado", "ar condicionado com problema",
    "ar condicionado não está gelando", "ar não gela", "ar condicionado com defeito",
    "ar condicionado barulhento", "ar condicionado com cheiro", "manutenção preventiva",
  ],
  requiredData: [
    "tipo_equipamento",
    "capacidade_btus",
    "quantidade",
    "problema_descricao",
    "ultimo_servico",
    "endereco_regiao",
  ],
  phases: [
    {
      id: "fase_1",
      title: "Diagnóstico Inicial",
      icon: "🔍",
      description: "Perguntar se há um problema específico (sintoma) ou se é uma manutenção preventiva de rotina.",
      type: "trigger",
    },
    {
      id: "fase_2",
      title: "Identificação do Equipamento",
      icon: "🌬️",
      description: "Coletar tipo de aparelho (Split/Janela), capacidade em BTUs e quantidade de unidades.",
      type: "question",
    },
    {
      id: "fase_3",
      title: "Histórico de Manutenção",
      icon: "📋",
      description: "Perguntar quando foi a última manutenção para definir o serviço mais adequado.",
      type: "question",
    },
    {
      id: "fase_4",
      title: "Região / Localização",
      icon: "📍",
      description: "Coletar bairro/região para verificar disponibilidade e calcular deslocamento.",
      type: "question",
    },
    {
      id: "fase_5",
      title: "Orçamento & Recomendação",
      icon: "💰",
      description: "Apresentar valor e tipo de serviço recomendado (limpeza simples, completa ou diagnóstico técnico).",
      type: "output",
    },
  ],
  buildPrompt: () => `
## 🚨 SCRIPT ATIVO: MANUTENÇÃO DE AR CONDICIONADO

O cliente demonstrou interesse em **MANUTENÇÃO / REVISÃO DE AR CONDICIONADO**.
Siga o roteiro abaixo. UMA PERGUNTA POR VEZ.

### ✅ CHECKLIST OBRIGATÓRIO
- [ ] Tipo de equipamento (Split, Janela...)
- [ ] Capacidade em BTUs
- [ ] Quantidade de aparelhos
- [ ] Descrição do problema ou motivo da manutenção
- [ ] Quando foi a última manutenção (ou se nunca fez)
- [ ] Região / bairro

### FASE 1 — DIAGNÓSTICO INICIAL
> "Claro! Para te ajudar melhor: o ar condicionado está com algum problema específico, ou é uma manutenção preventiva de rotina?"

**Se tiver problema:** pergunte o sintoma (não gela, barulho, cheiro, água vazando, etc.)
**Se for preventivo:** ótimo, siga para entender o equipamento.

### FASE 2 — EQUIPAMENTO
> "Qual o tipo de aparelho? É Split, Janela ou outro modelo?"
> "Qual a capacidade em BTUs? (9.000, 12.000, 18.000...)"
> "Quantos aparelhos precisam de manutenção?"

### FASE 3 — HISTÓRICO
> "Quando foi a última manutenção no aparelho? Pergunto porque isso ajuda a definir o serviço mais adequado."

### FASE 4 — REGIÃO
> "Qual o bairro ou região para eu verificar a disponibilidade e calcular o valor?"

### FASE 5 — ORÇAMENTO
Apresente o valor após coletar todos os dados, incluindo tipo de serviço recomendado (limpeza simples vs. limpeza completa vs. diagnóstico técnico).
`.trim(),
};

// ============================================
// SCRIPT: LIMPEZA DE AR CONDICIONADO
// ============================================

const acCleaningScript: IntentScript = {
  id: "ac_cleaning",
  label: "Limpeza de Ar Condicionado",
  triggers: [
    "limpeza", "higienização", "higienizacao", "limpar ar condicionado",
    "limpeza de ar", "limpeza split", "limpeza do ar", "higienização de ar",
    "ar condicionado com cheiro", "ar fedendo", "ar com mau cheiro",
  ],
  requiredData: [
    "tipo_equipamento",
    "capacidade_btus",
    "quantidade",
    "ultimo_servico",
    "endereco_regiao",
  ],
  phases: [
    {
      id: "fase_1",
      title: "Tipo de Equipamento",
      icon: "🌬️",
      description: "Identificar o tipo de aparelho (Split, Janela ou outro modelo).",
      type: "trigger",
    },
    {
      id: "fase_2",
      title: "BTUs & Quantidade",
      icon: "❄️",
      description: "Perguntar a capacidade em BTUs e quantos aparelhos precisam de limpeza.",
      type: "question",
    },
    {
      id: "fase_3",
      title: "Histórico de Limpeza",
      icon: "📋",
      description: "Perguntar quando foi a última limpeza para recomendar limpeza simples ou higienização completa com bactericida.",
      type: "question",
    },
    {
      id: "fase_4",
      title: "Região / Localização",
      icon: "📍",
      description: "Coletar bairro/região para calcular o valor com deslocamento.",
      type: "question",
    },
    {
      id: "fase_5",
      title: "Orçamento & Tipo de Limpeza",
      icon: "✨",
      description: "Apresentar o valor e o tipo de limpeza recomendado baseado no histórico do aparelho.",
      type: "output",
    },
  ],
  buildPrompt: () => `
## 🚨 SCRIPT ATIVO: LIMPEZA DE AR CONDICIONADO

O cliente está interessado em **LIMPEZA / HIGIENIZAÇÃO DE AR CONDICIONADO**.
Siga o roteiro. UMA PERGUNTA POR VEZ.

### ✅ CHECKLIST OBRIGATÓRIO
- [ ] Tipo de equipamento (Split, Janela...)
- [ ] Capacidade em BTUs
- [ ] Quantidade de aparelhos
- [ ] Última limpeza (para recomendar tipo: simples ou completa)
- [ ] Região / bairro

### FASE 1 — EQUIPAMENTO
> "Ótimo! Vamos à limpeza. Primeiro: qual o tipo de aparelho? Split, Janela ou outro?"

### FASE 2 — BTUs E QUANTIDADE
> "Qual a capacidade em BTUs?" → depois → "Quantos aparelhos?"

### FASE 3 — HISTÓRICO
> "Quando foi a última limpeza? Isso ajuda a determinar se recomendamos a limpeza simples ou a higienização completa com bactericida."

### FASE 4 — REGIÃO
> "Qual o bairro ou região para eu calcular o valor com deslocamento?"

### FASE 5 — ORÇAMENTO
Apresente o valor e o tipo de limpeza recomendado baseado no histórico.
`.trim(),
};

// ============================================
// MAPA DE SCRIPTS
// ============================================

export const INTENT_SCRIPTS: Record<string, IntentScript> = {
  ac_installation: acInstallationScript,
  ac_maintenance: acMaintenanceScript,
  ac_cleaning: acCleaningScript,
};

// ============================================
// DETECTOR DE INTENÇÃO
// ============================================

/**
 * Detecta qual script deve ser ativado baseado na mensagem do cliente.
 * Retorna o ID do script ou null se nenhum script for detectado.
 *
 * @param message - Mensagem atual ou histórico recente da conversa
 */
export function detectIntentScript(message: string): string | null {
  if (!message) return null;

  const normalized = message.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // Remove acentos para comparação

  // Verifica cada script na ordem de prioridade
  const scriptsByPriority = [
    "ac_installation",
    "ac_cleaning",
    "ac_maintenance",
  ];

  for (const scriptId of scriptsByPriority) {
    const script = INTENT_SCRIPTS[scriptId];
    if (!script) continue;

    const matched = script.triggers.some(trigger => {
      const normalizedTrigger = trigger
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      return normalized.includes(normalizedTrigger);
    });

    if (matched) {
      return scriptId;
    }
  }

  return null;
}

// ============================================
// SEÇÃO DO PROMPT
// ============================================

/**
 * Gera a seção de prompt com o script de intenção detectado.
 * Se nenhum script for detectado, retorna uma seção vazia.
 *
 * @param intentScriptId - ID do script a ser ativado (ou null)
 */
export function getIntentScriptSection(intentScriptId?: string | null): PromptSection {
  const emptySection: PromptSection = {
    id: "section_intent_script",
    title: "SCRIPT DE INTENÇÃO",
    priority: 11, // Logo após o objetivo principal
    required: false,
    version: VERSION,
    content: "",
  };

  if (!intentScriptId || !INTENT_SCRIPTS[intentScriptId]) {
    return emptySection;
  }

  const script = INTENT_SCRIPTS[intentScriptId];

  return {
    id: "section_intent_script",
    title: `SCRIPT: ${script.label.toUpperCase()}`,
    priority: 11,
    required: false,
    version: VERSION,
    content: script.buildPrompt(),
  };
}
