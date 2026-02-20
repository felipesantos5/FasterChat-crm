/**
 * ============================================
 * INTENT SCRIPTS - Scripts de Atendimento por Intenção
 * ============================================
 * Versão: 2.0.0
 *
 * Os scripts são criados PELOS USUÁRIOS via admin, sem nenhum script padrão.
 * Cada empresa pode criar seus próprios scripts com:
 * - Triggers (palavras-chave que ativam o script)
 * - Perguntas sequenciais (uma por vez)
 * - Dados obrigatórios a coletar
 * - Instruções personalizadas para a IA
 *
 * Persistência de estado: o script ativo é salvo na Conversation.activeIntentScriptId
 * para que a IA continue o mesmo fluxo durante toda a conversa.
 *
 * Saída do script: a IA sai automaticamente quando o cliente:
 * - Muda de assunto claramente (pergunta sobre outra coisa)
 * - Pede para cancelar / voltar / não quer mais
 * - O script é considerado concluído (todos os dados coletados)
 */

import { PromptSection } from "../types";

const VERSION = "2.0.0";

// ============================================
// TIPOS PÚBLICOS
// ============================================

export interface IntentScriptPhase {
  id: string;
  title: string;
  icon: string;       // emoji
  description: string;
  type: "trigger" | "question" | "action" | "output";
}

export interface IntentScript {
  /** Identificador único — gerado pelo usuário ou UUID */
  id: string;
  /** Label amigável exibido no admin */
  label: string;
  /** Palavras-chave base (triggers principais) */
  triggers: string[];
  /** Dados obrigatórios que DEVEM ser coletados antes de avançar */
  requiredData: string[];
  /** Fases visuais do fluxo (renderização no admin) */
  phases: IntentScriptPhase[];

  // Campos de configuração por empresa (preenchidos ao buscar do banco)
  enabled?: boolean;
  customTriggers?: string[];
  customInstructions?: string;
}

// ============================================
// INTERFACE DE CONFIG DA EMPRESA
// ============================================

export interface IntentScriptCompanyConfig {
  enabled: boolean;
  customTriggers?: string[];
  customInstructions?: string;
}

export interface IntentScriptsCompanyConfig {
  [scriptId: string]: IntentScriptCompanyConfig & {
    // Dados completos do script (label, triggers, requiredData, phases, buildPrompt)
    id: string;
    label: string;
    triggers: string[];
    requiredData: string[];
    phases: IntentScriptPhase[];
    /** Instruções de como conduzir o script (gerado dinamicamente) */
    promptInstructions?: string;
  };
}

// ============================================
// BUILDER DE PROMPT DINÂMICO
// ============================================

/**
 * Gera o bloco de prompt para um script de usuário.
 * Usa os dados configurados pelo usuário: triggers, requiredData, phases, customInstructions.
 */
export function buildDynamicScriptPrompt(script: {
  id: string;
  label: string;
  triggers: string[];
  requiredData: string[];
  phases: IntentScriptPhase[];
  customInstructions?: string;
  collectedData?: Record<string, string>;
}): string {
  const { label, requiredData, phases, customInstructions, collectedData = {} } = script;

  // Monta checklist de dados a coletar
  const checklist = requiredData.map(item => {
    const alreadyCollected = Object.keys(collectedData).some(key =>
      key.toLowerCase() === item.toLowerCase()
    );
    return `- [${alreadyCollected ? 'x' : ' '}] ${item}`;
  }).join('\n');

  // Monta descrição das fases
  const phasesDescription = phases.map((phase, i) => {
    const typeLabel = {
      trigger: '🎯 GATILHO',
      question: '❓ PERGUNTA',
      action: '⚡ AÇÃO',
      output: '📤 SAÍDA',
    }[phase.type] || '📌';

    return `### FASE ${i + 1} — ${phase.icon} ${phase.title.toUpperCase()} [${typeLabel}]\n${phase.description}`;
  }).join('\n\n');

  const customBlock = customInstructions?.trim()
    ? `\n\n### 📌 INSTRUÇÕES ESPECIAIS DESTA EMPRESA\n${customInstructions}`
    : '';

  return `
## 🚨 SCRIPT ATIVO: ${label.toUpperCase()}

O cliente demonstrou interesse em **${label.toUpperCase()}**.
Siga este roteiro estruturado. **UMA PERGUNTA POR MENSAGEM. NUNCA PULE ETAPAS.**

---

### REGRA CRÍTICA: UMA PERGUNTA POR VEZ
❌ NUNCA faça mais de 1 pergunta na mesma mensagem.
✅ Colete os dados UM POR UM, de forma conversacional e natural.
✅ Aguarde a resposta do cliente antes de fazer a próxima pergunta.

---

### ✅ CHECKLIST OBRIGATÓRIO (colete TODOS antes de avançar)
${checklist || '- Siga as fases abaixo'}

---

${phasesDescription}

---

### ⚠️ QUANDO SAIR DESTE SCRIPT
Você deve **sair do script e voltar ao atendimento normal** apenas se:
- O cliente claramente mudar de assunto (ex: perguntar sobre outra coisa completamente diferente)
- O cliente disser que não quer mais / cancelar / "esquece" / "não preciso mais"
- Você tiver coletado TODOS os dados obrigatórios acima

**Enquanto o cliente responder sobre ${label}, continue o script!**
Não saia por falta de resposta, demora ou respostas curtas como "ok", "sim", "pode ser".

---

### ❌ PROIBIDO
- Inventar preços — use SEMPRE os valores cadastrados no catálogo de serviços
- Pular para agendamento sem ter todos os dados
- Fazer mais de uma pergunta por mensagem
- Sair do script se o cliente ainda estiver respondendo sobre ${label}${customBlock}
`.trim();
}

// ============================================
// DETECTOR DE INTENÇÃO (baseado em configs do banco)
// ============================================

/**
 * Detecta qual script deve ser ativado baseado na mensagem do cliente.
 * Agora recebe as configurações da empresa do banco de dados.
 *
 * @param message - Mensagem atual do cliente
 * @param companyScripts - Scripts configurados pela empresa (do banco)
 * @returns ID do script ativado ou null
 */
export function detectIntentScriptFromConfig(
  message: string,
  companyScripts: IntentScriptsCompanyConfig
): string | null {
  if (!message || !companyScripts) return null;

  const normalized = message.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Verifica cada script habilitado pela empresa
  for (const [scriptId, scriptConfig] of Object.entries(companyScripts)) {
    if (!scriptConfig.enabled) continue;

    // Combina triggers base + custom triggers da empresa
    const allTriggers = [
      ...scriptConfig.triggers,
      ...(scriptConfig.customTriggers || []),
    ];

    const matched = allTriggers.some(trigger => {
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

/**
 * Detecta se o cliente está tentando SAIR do script atual.
 * Usado para resetar o script ativo quando o cliente muda de assunto.
 *
 * @param message - Mensagem atual do cliente
 * @param currentScriptLabel - Label do script atual (para contexto)
 */
export function detectScriptExit(message: string, currentScriptLabel?: string): boolean {
  if (!message) return false;

  const normalized = message.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Palavras de cancelamento explícito
  const explicitExit = [
    "esquece", "esqueça", "nao quero mais", "não quero mais",
    "cancela", "cancelar", "desisti", "mudei de ideia",
    "nao preciso", "não preciso", "para", "chega",
    "nao e isso", "não é isso", "outra coisa",
  ];

  return explicitExit.some(phrase => normalized.includes(phrase));
}

// ============================================
// SEÇÃO DO PROMPT (compatibilidade com sistema modular)
// ============================================

/**
 * Gera a seção de prompt com o script de intenção.
 * Adaptada para scripts criados pelo usuário.
 *
 * @param options - Opções para gerar a seção
 */
export function getIntentScriptSection(options?: {
  scriptId?: string | null;
  companyScripts?: IntentScriptsCompanyConfig;
  collectedData?: Record<string, string>;
}): PromptSection {
  const emptySection: PromptSection = {
    id: "section_intent_script",
    title: "SCRIPT DE INTENÇÃO",
    priority: 11,
    required: false,
    version: VERSION,
    content: "",
  };

  if (!options?.scriptId || !options?.companyScripts) {
    return emptySection;
  }

  const { scriptId, companyScripts, collectedData } = options;
  const scriptConfig = companyScripts[scriptId];

  if (!scriptConfig || !scriptConfig.enabled) {
    return emptySection;
  }

  const content = buildDynamicScriptPrompt({
    id: scriptId,
    label: scriptConfig.label,
    triggers: scriptConfig.triggers,
    requiredData: scriptConfig.requiredData,
    phases: scriptConfig.phases,
    customInstructions: scriptConfig.customInstructions,
    collectedData,
  });

  return {
    id: "section_intent_script",
    title: `SCRIPT: ${scriptConfig.label.toUpperCase()}`,
    priority: 11,
    required: false,
    version: VERSION,
    content,
  };
}

// ============================================
// LEGADO: Detecta intenção a partir dos triggers hardcoded
// (mantido apenas para retrocompatibilidade - NÃO USAR em código novo)
// ============================================

/** @deprecated Use detectIntentScriptFromConfig */
export function detectIntentScript(_message: string): string | null {
  // Sem scripts padrão — cada empresa cria os seus
  return null;
}

/** @deprecated Sem scripts hardcoded */
export const INTENT_SCRIPTS: Record<string, IntentScript> = {};
