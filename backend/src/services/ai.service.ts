import { prisma } from "../utils/prisma";
import conversationExampleService from "./conversation-example.service";
import openaiService from "./ai-providers/openai.service";
import anthropicService from "./ai-providers/anthropic.service";
import { AIProvider } from "../types/ai-provider";
import { essentialTools } from "./ai-tools";

/**
 * ============================================
 * CONFIGURAÇÕES DO CHATBOT - VALORES OTIMIZADOS
 * ============================================
 * Estas configurações foram otimizadas para melhor performance
 * de um chatbot profissional de atendimento ao cliente.
 * NÃO são configuráveis pelo cliente final.
 */
const CHATBOT_CONFIG = {
  // ===== JANELA DE CONTEXTO =====
  // Número máximo de mensagens a buscar do banco
  // Usado como limite inicial antes de aplicar otimizações
  MAX_MESSAGES_TO_FETCH: 20,

  // ===== LIMITE DE TOKENS DO HISTÓRICO =====
  // Máximo de tokens permitidos para o histórico de mensagens
  // GPT-4o Mini tem 128k de contexto, mas reservamos espaço para:
  // - System prompt (~1500 tokens)
  // - Resposta (~400 tokens)
  // - Margem de segurança
  MAX_HISTORY_TOKENS: 2000,

  // ===== TEMPERATURA =====
  // Controla criatividade vs consistência das respostas
  // 0.0 = muito determinístico, sempre mesma resposta
  // 0.3-0.5 = consistente mas com variação natural (IDEAL PARA ATENDIMENTO)
  // 0.7-1.0 = mais criativo, pode variar muito
  TEMPERATURE: 0.4,

  // ===== MAX TOKENS DE RESPOSTA =====
  // Limite máximo de tokens na resposta da IA
  // 300 = respostas curtas e diretas (ideal WhatsApp)
  // 500 = respostas médias com mais detalhes
  // 800 = respostas longas para explicações complexas
  MAX_TOKENS: 400,

  // ===== CONFIGURAÇÕES DE RETRY =====
  // Tentativas em caso de falha na API
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,

  // ===== MODELO PADRÃO =====
  // Modelo usado quando não especificado
  DEFAULT_MODEL: "gpt-4o-mini",

  // ===== PRESENÇA E FREQUÊNCIA =====
  // Penalidades para evitar repetições
  // 0 = sem penalidade, 2.0 = máxima penalidade
  PRESENCE_PENALTY: 0.1,  // Evita repetir tópicos já mencionados
  FREQUENCY_PENALTY: 0.1, // Evita repetir palavras/frases
};

/**
 * ============================================
 * UTILITÁRIOS DE CONTAGEM DE TOKENS
 * ============================================
 * Estimativa de tokens usando regra prática:
 * ~4 caracteres = 1 token (para português)
 * ~0.75 palavras = 1 token
 */

/**
 * Estima o número de tokens em um texto
 * Usa aproximação: 1 token ≈ 4 caracteres para português
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // Regra prática: ~4 caracteres por token em português
  // Considera também espaços e pontuação
  return Math.ceil(text.length / 4);
}

/**
 * Interface para mensagem agrupada
 */
interface GroupedMessage {
  sender: string;
  senderType: string;
  messages: string[];
  hasMedia: boolean;
  mediaTypes: string[];
  tokenCount: number;
}

class AIService {
  /**
   * Obtém o provedor de IA configurado
   */
  private getProvider(providerName?: AIProvider) {
    // Usa o provedor especificado ou o padrão do .env
    const provider = providerName || (process.env.AI_PROVIDER as AIProvider) || "openai";

    switch (provider) {
      case "openai":
        return openaiService;
      case "anthropic":
        return anthropicService;
      default:
        console.warn(`Unknown AI provider: ${provider}. Falling back to OpenAI.`);
        return openaiService;
    }
  }

  /**
   * Gera resposta automática usando o provedor configurado
   */
  async generateResponse(
    customerId: string,
    message: string,
    options?: { provider?: AIProvider; model?: string; temperature?: number; maxTokens?: number }
  ): Promise<string> {
    try {
      // Busca o customer com informações da empresa
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          company: {
            include: {
              aiKnowledge: true,
            },
          },
        },
      });

      if (!customer) {
        throw new Error("Customer not found");
      }

      // 🎯 JANELA DE CONTEXTO DESLIZANTE COM OTIMIZAÇÃO
      // Busca mais mensagens do que precisamos para ter margem de otimização
      const messages = await prisma.message.findMany({
        where: { customerId },
        orderBy: { timestamp: "desc" },
        take: CHATBOT_CONFIG.MAX_MESSAGES_TO_FETCH,
        include: {
          customer: true,
        },
      });

      // Inverte para ordem cronológica (mais antiga primeiro)
      const messageHistory = messages.reverse();

      // Monta o contexto da empresa
      const aiKnowledge = customer.company.aiKnowledge;

      // Verifica se resposta automática está habilitada
      // Por padrão, a IA responde EXCETO se autoReplyEnabled === false explicitamente
      if (aiKnowledge && aiKnowledge.autoReplyEnabled === false) {
        throw new Error("Auto-reply is disabled for this company");
      }

      // Contexto do negócio vem do cadastro do cliente
      const companyInfo = aiKnowledge?.companyInfo || "Informações da empresa não disponíveis.";
      const productsServices = aiKnowledge?.productsServices || "Produtos/serviços não especificados.";
      const policies = aiKnowledge?.policies || "";
      const negativeExamples = aiKnowledge?.negativeExamples || null;
      const serviceArea = aiKnowledge?.serviceArea || null;
      const workingHours = aiKnowledge?.workingHours || null;
      const paymentMethods = aiKnowledge?.paymentMethods || null;
      const deliveryInfo = aiKnowledge?.deliveryInfo || null;

      // Pega configurações avançadas da IA
      // NOTA: temperatura e maxTokens usam valores otimizados fixos (não configuráveis pelo cliente)
      const providerConfig = aiKnowledge?.provider as AIProvider | undefined;
      const modelConfig = aiKnowledge?.model ?? CHATBOT_CONFIG.DEFAULT_MODEL;
      const temperature = CHATBOT_CONFIG.TEMPERATURE;
      const maxTokens = CHATBOT_CONFIG.MAX_TOKENS;

      // 🎯 OTIMIZAÇÃO: Agrupa mensagens sequenciais do mesmo remetente
      // e aplica limite de tokens para não estourar contexto
      const { historyText, stats } = this.buildOptimizedHistory(messageHistory, customer.name);

      console.log(`[AIService] Context stats: ${stats.totalMessages} msgs → ${stats.groupedBlocks} blocks, ~${stats.totalTokens} tokens`);

      // Busca exemplos de conversas exemplares (limitado para otimização)
      const examplesText = await conversationExampleService.getExamplesForPrompt(customer.companyId);

      // Monta o prompt otimizado para GPT-4o Mini
      // Comportamento básico é hardcoded, contexto do negócio vem do cliente
      const systemPrompt = this.buildOptimizedPrompt({
        companyName: customer.company.name,
        companyInfo,
        productsServices,
        policies,
        examplesText,
        negativeExamples,
        serviceArea,
        workingHours,
        paymentMethods,
        deliveryInfo,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerEmail: customer.email,
        customerTags: customer.tags,
        customerNotes: customer.notes,
      });

      const userPrompt = this.buildUserPrompt(historyText, message);

      // Seleciona e usa o provedor (prioriza configuração da empresa)
      const providerName = options?.provider || providerConfig || (process.env.AI_PROVIDER as AIProvider) || "openai";
      const provider = this.getProvider(providerName);

      if (!provider.isConfigured()) {
        throw new Error(`AI provider is not configured. Please check your environment variables.`);
      }

      const lastMessage = messageHistory[messageHistory.length - 1];
      let imageUrlForVision: string | undefined = undefined;

      // Se a última mensagem do cliente for uma imagem, passamos para a IA analisar
      if (lastMessage && lastMessage.direction === "INBOUND" && lastMessage.mediaType === "image" && lastMessage.mediaUrl) {
        imageUrlForVision = lastMessage.mediaUrl;
        console.log("[AIService] Image detected, enabling Vision capabilities");
      }

      // 🎯 Function Calling: Passa tools apenas para OpenAI (Anthropic não suporta ainda)
      const useTools = providerName === "openai" || (options?.provider || providerConfig) === "openai";

      const aiResponse = await provider.generateResponse({
        systemPrompt,
        userPrompt,
        temperature,
        maxTokens,
        model: options?.model || modelConfig,
        imageUrl: imageUrlForVision,
        // Adiciona tools e contexto para Function Calling
        ...(useTools && {
          tools: essentialTools,
          toolChoice: "auto", // IA decide quando usar
          context: {
            customerId: customer.id,
            companyId: customer.companyId,
          },
        }),
      });

      // Remove qualquer formatação Markdown que a IA possa ter usado
      const cleanResponse = this.removeMarkdown(aiResponse);

      return cleanResponse;
    } catch (error: any) {
      console.error("AI Error:", error.message);
      throw new Error(`Failed to generate AI response: ${error.message}`);
    }
  }

  /**
   * Constrói histórico otimizado com agrupamento e limite de tokens
   *
   * Otimizações:
   * 1. Agrupa mensagens sequenciais do mesmo remetente
   * 2. Aplica limite de tokens para não estourar contexto
   * 3. Prioriza mensagens mais recentes
   */
  private buildOptimizedHistory(
    messageHistory: any[],
    customerName: string
  ): { historyText: string; stats: { totalMessages: number; groupedBlocks: number; totalTokens: number } } {
    if (!messageHistory || messageHistory.length === 0) {
      return {
        historyText: "(Início da conversa)",
        stats: { totalMessages: 0, groupedBlocks: 0, totalTokens: 0 },
      };
    }

    // 1. Agrupa mensagens sequenciais do mesmo remetente
    const groupedMessages: GroupedMessage[] = [];
    let currentGroup: GroupedMessage | null = null;

    for (const msg of messageHistory) {
      const isInbound = msg.direction === "INBOUND";
      const sender = isInbound ? customerName : "Assistente";
      const senderType = isInbound ? "customer" : (msg.senderType === "HUMAN" ? "human" : "ai");

      // Detecta mídia
      const mediaType = msg.mediaType || null;

      if (currentGroup && currentGroup.sender === sender && currentGroup.senderType === senderType) {
        // Mesma pessoa, adiciona à mensagem atual
        currentGroup.messages.push(msg.content);
        if (mediaType) {
          currentGroup.hasMedia = true;
          if (!currentGroup.mediaTypes.includes(mediaType)) {
            currentGroup.mediaTypes.push(mediaType);
          }
        }
      } else {
        // Nova pessoa, cria novo grupo
        if (currentGroup) {
          groupedMessages.push(currentGroup);
        }
        currentGroup = {
          sender,
          senderType,
          messages: [msg.content],
          hasMedia: !!mediaType,
          mediaTypes: mediaType ? [mediaType] : [],
          tokenCount: 0,
        };
      }
    }

    // Adiciona último grupo
    if (currentGroup) {
      groupedMessages.push(currentGroup);
    }

    // 2. Calcula tokens e formata cada bloco
    const formattedBlocks: string[] = [];
    let totalTokens = 0;

    // Processa do mais recente para o mais antigo (para priorizar recentes)
    const reversedGroups = [...groupedMessages].reverse();

    for (const group of reversedGroups) {
      // Formata o bloco
      let senderLabel = group.sender;
      if (group.senderType === "human") {
        senderLabel += " (Atendente)";
      }

      // Indicador de mídia
      let mediaIndicator = "";
      if (group.hasMedia) {
        if (group.mediaTypes.includes("audio")) mediaIndicator += " 🎤";
        if (group.mediaTypes.includes("image")) mediaIndicator += " 📷";
      }

      // Une mensagens do mesmo remetente com quebra de linha simples
      const content = group.messages.join("\n");
      const blockText = `${senderLabel}${mediaIndicator}: ${content}`;

      // Calcula tokens do bloco
      const blockTokens = estimateTokens(blockText);

      // Verifica se ainda cabe no limite
      if (totalTokens + blockTokens > CHATBOT_CONFIG.MAX_HISTORY_TOKENS) {
        // Não cabe mais, para de adicionar
        console.log(`[AIService] Token limit reached (${totalTokens}/${CHATBOT_CONFIG.MAX_HISTORY_TOKENS}), stopping at ${formattedBlocks.length} blocks`);
        break;
      }

      formattedBlocks.unshift(blockText); // Adiciona no início para manter ordem cronológica
      totalTokens += blockTokens;
      group.tokenCount = blockTokens;
    }

    // 3. Junta todos os blocos
    const historyText = formattedBlocks.join("\n\n");

    return {
      historyText,
      stats: {
        totalMessages: messageHistory.length,
        groupedBlocks: formattedBlocks.length,
        totalTokens,
      },
    };
  }

  /**
   * Remove formatação Markdown da resposta da IA
   * WhatsApp não renderiza markdown, então removemos para evitar ** e _ aparecendo no texto
   */
  private removeMarkdown(text: string): string {
    return (
      text
        // Remove bold: **texto** ou __texto__
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        // Remove italic: *texto* ou _texto_
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/_(.+?)_/g, "$1")
        // Remove strikethrough: ~~texto~~
        .replace(/~~(.+?)~~/g, "$1")
        // Remove code: `texto`
        .replace(/`(.+?)`/g, "$1")
        // Remove headers: # texto
        .replace(/^#+\s+/gm, "")
        // Remove listas: - item ou * item
        .replace(/^[\*\-]\s+/gm, "")
        // Remove links: [texto](url)
        .replace(/\[(.+?)\]\(.+?\)/g, "$1")
        // Remove > (quote)
        .replace(/^>\s+/gm, "")
    );
  }

  /**
   * Constrói prompt otimizado para chatbot profissional
   *
   * ESTRUTURA DO PROMPT:
   * 1. IDENTIDADE - Quem é a IA (hardcoded)
   * 2. CONTEXTO DO NEGÓCIO - Vem do cadastro do cliente
   * 3. COMPORTAMENTO - Regras de conduta (hardcoded)
   * 4. SEGURANÇA - Proteções (hardcoded)
   * 5. DADOS DO CLIENTE - Info do contato atual
   */
  private buildOptimizedPrompt(data: any): string {
    const {
      companyName,
      companyInfo,
      productsServices,
      policies,
      negativeExamples,
      serviceArea,
      workingHours,
      paymentMethods,
      deliveryInfo,
      customerName,
    } = data;

    // ========================================
    // SEÇÃO 1: IDENTIDADE (HARDCODED)
    // ========================================
    const identitySection = `VOCÊ É: Assistente Virtual da ${companyName}
FUNÇÃO: Atendimento ao cliente via WhatsApp

Você é um atendente virtual inteligente, profissional e prestativo.
Seu objetivo é ajudar os clientes com informações, tirar dúvidas e encaminhar para atendimento humano quando necessário.`;

    // ========================================
    // SEÇÃO 2: CONTEXTO DO NEGÓCIO (DO CLIENTE)
    // ========================================
    let businessContext = `\n# 📋 INFORMAÇÕES DA EMPRESA\n`;
    businessContext += companyInfo || "Empresa de atendimento ao cliente.";

    businessContext += `\n\n# 🛒 PRODUTOS E SERVIÇOS\n`;
    businessContext += productsServices || "Consulte o atendente para informações sobre produtos e serviços.";

    // Informações operacionais
    if (workingHours || paymentMethods || deliveryInfo || policies) {
      businessContext += `\n\n# ⚙️ INFORMAÇÕES OPERACIONAIS\n`;
      if (workingHours) businessContext += `**Horário de Atendimento:** ${workingHours}\n`;
      if (paymentMethods) businessContext += `**Formas de Pagamento:** ${paymentMethods}\n`;
      if (deliveryInfo) businessContext += `**Entrega/Prazos:** ${deliveryInfo}\n`;
      if (policies) businessContext += `**Políticas:** ${policies}\n`;
    }

    // Área de atendimento
    if (serviceArea) {
      businessContext += `\n\n# 📍 ÁREA DE ATENDIMENTO\n`;
      businessContext += `A empresa atende nas seguintes regiões:\n${serviceArea}\n\n`;
      businessContext += `⚠️ IMPORTANTE: Antes de agendar serviços presenciais, SEMPRE pergunte o bairro/cidade/CEP do cliente e verifique se está dentro da área de atendimento.`;
    }

    // O que não fazer (configurado pelo cliente)
    if (negativeExamples) {
      businessContext += `\n\n# ❌ O QUE NÃO FAZER\n${negativeExamples}`;
    }

    // ========================================
    // SEÇÃO 3: COMPORTAMENTO (HARDCODED)
    // ========================================
    const behaviorSection = `
# 💬 COMPORTAMENTO PROFISSIONAL

## Tom de Comunicação
- Seja educado, profissional e acolhedor
- Use linguagem clara, objetiva e fácil de entender
- Trate o cliente com respeito, usando "você" ou o nome dele
- Respostas diretas sem enrolação

## Estrutura das Respostas
- Respostas curtas (máximo 3-4 linhas por bloco)
- Use quebras de linha para organizar informações
- Uma pergunta por vez (não sobrecarregue o cliente)
- NÃO use formatação Markdown (*, **, _, etc.)
- Se já houver histórico, NÃO repita saudações

## Emojis
- Use com moderação (máximo 2-3 por mensagem)
- Emojis profissionais: ✅ 📦 💳 ⏰
- Evite emojis informais ou excessivos

## Fluxo Natural
1. Cumprimente apenas na PRIMEIRA mensagem
2. Identifique a necessidade do cliente
3. Responda de forma objetiva
4. Ofereça próximo passo ou ajuda adicional`;

    // ========================================
    // SEÇÃO 4: SEGURANÇA (HARDCODED)
    // ========================================
    const securitySection = `
# 🔒 REGRAS DE SEGURANÇA (CRÍTICO)

## Sobre Valores e Prazos
- NUNCA invente preços, valores ou prazos
- SÓ informe o que está cadastrado em "PRODUTOS E SERVIÇOS"
- Se não souber o preço: "Preciso verificar o valor atualizado. Posso solicitar um orçamento?"
- NUNCA arredonde ou "chute" valores

## Informações Proibidas - NUNCA REVELE
- Dados financeiros da empresa (faturamento, lucros, custos)
- Dados pessoais de funcionários ou outros clientes
- Senhas, acessos ou informações técnicas internas
- Problemas técnicos ou erros do sistema
- Para o cliente, tudo funciona normalmente

## Assuntos Proibidos - NUNCA DISCUTA
- Política, religião ou temas polêmicos
- Opiniões pessoais
- Comparações negativas com concorrentes

Se perguntarem sobre assunto proibido:
"Desculpe, não posso ajudar com esse assunto. Posso te ajudar com informações sobre nossos produtos e serviços!"`;

    // ========================================
    // SEÇÃO 5: AÇÕES ESPECIAIS (HARDCODED)
    // ========================================
    const actionsSection = `
# 📅 AGENDAMENTOS

Use [INICIAR_AGENDAMENTO] APENAS quando:
- Cliente diz EXPLICITAMENTE que quer agendar
- Você já informou o serviço e valor
- Já verificou se está na área de atendimento

NUNCA use quando o cliente está apenas tirando dúvidas ou comparando opções.

Formato: [INICIAR_AGENDAMENTO] Sua mensagem aqui...

# 🚨 TRANSBORDO PARA HUMANO

Use [TRANSBORDO] quando:
- Cliente pede para falar com humano/atendente
- Reclamações graves ou cliente insatisfeito
- Problemas com pagamento, garantia ou devolução
- Situações que você não consegue resolver

Formato: [TRANSBORDO] Vou transferir você para um especialista. Um momento!`;

    // ========================================
    // SEÇÃO 6: DADOS DO CLIENTE
    // ========================================
    const customerSection = `
# 👤 CLIENTE ATUAL
Nome: ${customerName}${data.customerTags?.length ? `\nTags: ${data.customerTags.join(", ")}` : ""}${data.customerNotes ? `\nObservações: ${data.customerNotes}` : ""}`;

    // ========================================
    // MONTA O PROMPT FINAL
    // ========================================
    return `${identitySection}
${businessContext}
${behaviorSection}
${securitySection}
${actionsSection}
${customerSection}

Responda de forma natural e conversacional:`;
  }

  /**
   * Constrói prompt do usuário
   */
  private buildUserPrompt(historyText: string, currentMessage: string): string {
    // Adiciona data/hora atual para noção temporal
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

    return `DATA/HORA ATUAL: ${now}

# HISTÓRICO DA CONVERSA (Mensagens Anteriores)
${historyText ? historyText : "(Início da conversa)"}

# MENSAGEM ATUAL DO CLIENTE
${currentMessage}

Sua resposta (lembre-se: sem 'Oi' repetitivo se já houver histórico):`;
  }

  /**
   * Verifica se algum provedor está configurado
   */
  isConfigured(): boolean {
    return openaiService.isConfigured() || anthropicService.isConfigured();
  }

  /**
   * Retorna informações sobre o provedor atual
   */
  getCurrentProviderInfo() {
    const providerName = (process.env.AI_PROVIDER as AIProvider) || "openai";
    const provider = this.getProvider(providerName);
    return provider.getModelInfo();
  }

  /**
   * Lista todos os provedores disponíveis
   */
  getAvailableProviders() {
    return [
      {
        name: "openai",
        configured: openaiService.isConfigured(),
        info: openaiService.getModelInfo(),
      },
      {
        name: "anthropic",
        configured: anthropicService.isConfigured(),
        info: anthropicService.getModelInfo(),
      },
    ];
  }
}

export default new AIService();
