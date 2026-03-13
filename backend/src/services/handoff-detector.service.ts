/**
 * ============================================
 * Handoff Detector Service
 * ============================================
 *
 * Três camadas de proteção para transbordo:
 * 1. Keywords de intenção direta (regex, antes da IA)
 * 2. HANDOFF_ACTION token (detectado na resposta da IA)
 * 3. Detecção de loop semântico (hash de respostas repetidas)
 */

// ─── CAMADA 1: Keywords de Intenção Direta ─────────────────────────────────

const HANDOFF_KEYWORDS: RegExp[] = [
  /\b(quero|preciso|pode|deixa|me\s+)?(falar|conversar|atender)\s+(com\s+)?(um\s+)?(humano|atendente|pessoa|algu[eé]m|gente|ser\s+humano)/i,
  /\b(passa|transfere|conecta|chama)\s+(pra|para|um|uma|o|a)?\s*(atendente|humano|pessoa|gerente|responsável|supervisor)/i,
  /\b(quero|preciso)\s+(de\s+)?(um\s+)?(atendente|humano|pessoa\s+real|atendimento\s+humano)/i,
  /\bnão\s+quero\s+(falar\s+com\s+)?(robô|bot|ia|intelig[eê]ncia\s+artificial|máquina)/i,
  /\b(cadê|cade|onde\s+está?)\s+(o|a|um|uma)?\s*(atendente|humano|pessoa)/i,
  /\bfalar\s+com\s+(alguém|alguem)\s+(de\s+verdade|real)/i,
  /\batendimento\s+humano/i,
  /\bpessoa\s+de\s+verdade/i,
];

/**
 * Verifica se a mensagem do cliente contém intenção direta de falar com humano.
 * Roda ANTES de chamar a IA — evita gastar tokens desnecessariamente.
 */
export function detectDirectHandoffIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (normalized.length < 5) return false;
  return HANDOFF_KEYWORDS.some((regex) => regex.test(normalized));
}

// ─── CAMADA 2: Token HANDOFF_ACTION na resposta da IA ──────────────────────

/**
 * Verifica e limpa tokens de handoff na resposta da IA.
 * Suporta tanto [TRANSBORDO] quanto HANDOFF_ACTION.
 */
export function parseHandoffTokens(aiResponse: string): {
  shouldHandoff: boolean;
  cleanMessage: string;
  reason: string;
} {
  // [TRANSBORDO] no início
  if (aiResponse.startsWith("[TRANSBORDO]")) {
    return {
      shouldHandoff: true,
      cleanMessage: aiResponse.replace("[TRANSBORDO]", "").trim(),
      reason: "transbordo_ia",
    };
  }

  // HANDOFF_ACTION no final (ou em qualquer posição)
  if (aiResponse.includes("HANDOFF_ACTION")) {
    return {
      shouldHandoff: true,
      cleanMessage: aiResponse.replace(/\s*HANDOFF_ACTION\s*/g, "").trim(),
      reason: "handoff_action_ia",
    };
  }

  return {
    shouldHandoff: false,
    cleanMessage: aiResponse,
    reason: "",
  };
}

// ─── CAMADA 3: Detecção de Loop Semântico ──────────────────────────────────

// Cache em memória: customerId → últimos hashes de respostas da IA
const responseHashCache = new Map<string, string[]>();
const HASH_CACHE_SIZE = 3;
const SIMILARITY_THRESHOLD = 0.9;

/**
 * Gera um hash simples de uma string (para comparação rápida).
 * Usa conjunto de bigramas (2-grams) para capturar estrutura semântica.
 */
function getBigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[^a-záàâãéèêíïóôõúçñ\s]/gi, "").replace(/\s+/g, " ").trim();
  const bigrams = new Set<string>();
  for (let i = 0; i < normalized.length - 1; i++) {
    bigrams.add(normalized.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Calcula o coeficiente de Sørensen–Dice entre dois conjuntos de bigramas.
 * Retorna valor entre 0 (nada similar) e 1 (idêntico).
 */
function diceCoefficient(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const bigram of a) {
    if (b.has(bigram)) intersection++;
  }
  return (2 * intersection) / (a.size + b.size);
}

/**
 * Registra a resposta da IA e verifica se há loop semântico.
 * Retorna true se as últimas respostas forem muito similares.
 */
export function detectLoopAndRecord(customerId: string, aiResponse: string): boolean {
  const currentBigrams = getBigrams(aiResponse);

  if (!responseHashCache.has(customerId)) {
    responseHashCache.set(customerId, []);
  }

  const history = responseHashCache.get(customerId)!;

  // Compara com cada resposta anterior
  let highSimilarityCount = 0;
  for (const prevResponse of history) {
    const prevBigrams = getBigrams(prevResponse);
    const similarity = diceCoefficient(currentBigrams, prevBigrams);
    if (similarity >= SIMILARITY_THRESHOLD) {
      highSimilarityCount++;
    }
  }

  // Armazena a resposta atual (mantém apenas as últimas N)
  history.push(aiResponse);
  if (history.length > HASH_CACHE_SIZE) {
    history.shift();
  }

  // Se 2 ou mais das respostas anteriores são muito similares → loop
  return highSimilarityCount >= 2;
}

/**
 * Limpa o cache de loop para um cliente (ex: quando humano assume).
 */
export function clearLoopCache(customerId: string): void {
  responseHashCache.delete(customerId);
}

// Limpeza periódica do cache (evita memory leak)
setInterval(() => {
  const maxEntries = 5000;
  if (responseHashCache.size > maxEntries) {
    const entries = Array.from(responseHashCache.keys());
    const toDelete = entries.slice(0, entries.length - maxEntries);
    for (const key of toDelete) {
      responseHashCache.delete(key);
    }
  }
}, 10 * 60 * 1000);
