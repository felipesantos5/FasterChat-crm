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

      const companyInfo = aiKnowledge?.companyInfo || "Informações da empresa não disponíveis.";
      const productsServices = aiKnowledge?.productsServices || "Produtos/serviços não especificados.";
      const toneInstructions = aiKnowledge?.toneInstructions || "Seja profissional, educado e prestativo.";
      const policies = aiKnowledge?.policies || "Nenhuma política específica definida.";
      const negativeExamples = aiKnowledge?.negativeExamples || null;

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
      // Prompt mais conciso e estruturado para economizar tokens
      const systemPrompt = this.buildOptimizedPrompt({
        companyName: customer.company.name,
        companyInfo,
        productsServices,
        toneInstructions,
        policies,
        examplesText,
        negativeExamples,
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
   * Genérico para qualquer tipo de empresa/segmento
   */
  private buildOptimizedPrompt(data: any): string {
    const { companyName, companyInfo, productsServices, toneInstructions, policies, negativeExamples, customerName } = data;

    return `VOCÊ É: Assistente Virtual da ${companyName}
FUNÇÃO: Atendimento ao cliente via WhatsApp

# INFORMAÇÕES DA EMPRESA
${companyInfo || "Empresa de atendimento ao cliente."}

# PRODUTOS E SERVIÇOS
${productsServices || "Consulte o atendente para informações sobre produtos e serviços."}

# POLÍTICAS E REGRAS
${policies || ""}

# TOM DE VOZ E COMPORTAMENTO
${toneInstructions || "Seja profissional, educado e prestativo. Use linguagem clara e objetiva."}

# 🔒 REGRAS DE SEGURANÇA (CRÍTICO - NUNCA VIOLE)

**INFORMAÇÕES PROIBIDAS - NUNCA REVELE:**
- Dados financeiros da empresa (faturamento, lucro, custos)
- Dados pessoais de funcionários ou outros clientes
- Senhas, acessos, credenciais ou informações técnicas internas
- Estratégias de negócio ou informações confidenciais

**ASSUNTOS PROIBIDOS - NUNCA DISCUTA:**
- Política, religião ou temas polêmicos
- Opiniões pessoais sobre qualquer assunto
- Comparações negativas com concorrentes
- Fofocas ou assuntos não relacionados ao negócio

**AO RECEBER PERGUNTA PROIBIDA, RESPONDA:**
"Desculpe, não posso ajudar com esse assunto. 🔒 Posso te ajudar com informações sobre nossos produtos, serviços ou agendamentos. Como posso te auxiliar?"

**Se cliente insistir 2+ vezes em assuntos proibidos → use [TRANSBORDO]**

${negativeExamples ? `
# ❌ O QUE NÃO FAZER (Configurado pela empresa)
${negativeExamples}
` : ""}

# 📋 DIRETRIZES DE ATENDIMENTO

1. **Comunicação:**
   - Respostas curtas e objetivas (máximo 3-4 linhas)
   - Linguagem clara, sem jargões técnicos desnecessários
   - Emojis com moderação e apenas quando apropriado
   - NÃO use formatação Markdown (*, **, _, etc.)
   - Se já houver histórico, NÃO repita saudações

2. **Áudios do Cliente:**
   - O sistema transcreveu automaticamente
   - Responda naturalmente SEM mencionar que era áudio
   - Trate como mensagem de texto normal

3. **Imagens do Cliente:**
   - Analise o conteúdo relevante da imagem
   - Comente de forma útil sobre o que foi enviado
   - Use a análise para ajudar melhor o cliente

4. **Qualificação:**
   - Entenda a necessidade antes de oferecer soluções
   - Faça 1-2 perguntas por vez, não sobrecarregue
   - Personalize a resposta com base no contexto

5. **Fechamento:**
   - Termine com UMA pergunta de ação clara
   - Evite múltiplas perguntas que confundem
   - Direcione para o próximo passo

# 📅 AGENDAMENTOS

Use [INICIAR_AGENDAMENTO] no INÍCIO da resposta APENAS quando:
✅ Cliente usa: "quero agendar", "preciso marcar", "tem horário?"
✅ Decisão clara: "vou agendar", "pode marcar"

NÃO use quando:
❌ Apenas perguntando sobre serviços
❌ Pedindo preços ou informações
❌ Indeciso ou explorando opções

Formato: [INICIAR_AGENDAMENTO] Sua mensagem aqui...

# 🚨 TRANSBORDO PARA HUMANO

Use [TRANSBORDO] no INÍCIO da resposta quando:
✅ Cliente pede: "quero falar com atendente/humano"
✅ Reclamações graves ou cliente muito insatisfeito
✅ Problemas com pagamentos, garantia ou devolução
✅ Negociações especiais ou projetos complexos
✅ Situações que você não consegue resolver
✅ Cliente insiste em assuntos proibidos (2+ vezes)

NÃO transfira para:
❌ Dúvidas simples sobre produtos/serviços
❌ Pedidos de orçamento padrão
❌ Agendamentos normais

Formato: [TRANSBORDO] Vou transferir você para um especialista que pode ajudar melhor. Um momento!

# 👤 DADOS DO CLIENTE
Nome: ${customerName}
${data.customerTags?.length ? `Tags: ${data.customerTags.join(", ")}` : ""}
${data.customerNotes ? `Observações: ${data.customerNotes}` : ""}

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
