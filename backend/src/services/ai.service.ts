import { prisma } from "../utils/prisma";
import conversationExampleService from "./conversation-example.service";
import openaiService from "./ai-providers/openai.service";
import anthropicService from "./ai-providers/anthropic.service";
import { AIProvider } from "../types/ai-provider";
import { essentialTools } from "./ai-tools";

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

      // 🎯 OTIMIZAÇÃO: Janela de contexto deslizante inteligente
      // Busca apenas últimas 5 mensagens (reduz tokens em ~40%)
      // Tools fornecem contexto adicional sob demanda
      const messages = await prisma.message.findMany({
        where: { customerId },
        orderBy: { timestamp: "desc" },
        take: 5, // Reduzido de 10 para 5
        include: {
          customer: true,
        },
      });

      // Inverte para ordem cronológica (mais antiga primeiro)
      const messageHistory = messages.reverse();

      // Monta o contexto da empresa
      const aiKnowledge = customer.company.aiKnowledge;

      // Verifica se resposta automática está habilitada
      if (aiKnowledge && !aiKnowledge.autoReplyEnabled) {
        throw new Error("Auto-reply is disabled for this company");
      }

      const companyInfo = aiKnowledge?.companyInfo || "Informações da empresa não disponíveis.";
      const productsServices = aiKnowledge?.productsServices || "Produtos/serviços não especificados.";
      const toneInstructions = aiKnowledge?.toneInstructions || "Seja profissional, educado e prestativo.";
      const policies = aiKnowledge?.policies || "Nenhuma política específica definida.";
      const negativeExamples = aiKnowledge?.negativeExamples || null;

      // Pega configurações avançadas da IA
      const providerConfig = aiKnowledge?.provider as AIProvider | undefined;
      const modelConfig = aiKnowledge?.model ?? undefined;
      const temperature = options?.temperature ?? aiKnowledge?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? aiKnowledge?.maxTokens ?? 500;

      // Formata o histórico de mensagens de forma otimizada
      const historyText = messageHistory
        .map((msg) => {
          const sender = msg.direction === "INBOUND" ? customer.name : "Você";
          const senderTypeLabel = msg.senderType === "AI" ? "" : msg.senderType === "HUMAN" ? " (Atendente)" : "";

          // Adiciona indicador de tipo de mídia de forma sutil
          let mediaIndicator = "";
          if (msg.mediaType === "audio") {
            mediaIndicator = " 🎤";
          } else if (msg.mediaType === "image") {
            mediaIndicator = " 📷";
          }

          return `${sender}${senderTypeLabel}${mediaIndicator}: ${msg.content}`;
        })
        .join("\n");

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
   * Constrói prompt otimizado (mais conciso para GPT-4o Mini)
   */
  private buildOptimizedPrompt(data: any): string {
    const { companyName, companyInfo, productsServices, policies, negativeExamples, customerName } = data;

    return `ATUE COMO: Consultor de Vendas Sênior da ${companyName}.
OBJETIVO: Vender soluções de climatização (Instalação, Manutenção ou Aparelhos).

# CONTEXTO DO NEGÓCIO
${companyInfo}
${productsServices}
${policies}

# SUA PERSONALIDADE DE VENDAS (The Wolf of HVAC)

🎯 **REGRAS FUNDAMENTAIS:**

1. **🔒 SEGURANÇA E LIMITES (CRÍTICO - NUNCA VIOLE):**

   **VOCÊ NÃO PODE E NÃO DEVE:**

   ❌ **Informações da Empresa:**
   - NUNCA revelar faturamento, lucro, custos, margem de lucro
   - NUNCA revelar dados de funcionários (salários, CPF, endereços, telefones pessoais)
   - NUNCA revelar senhas, acessos, credenciais, tokens
   - NUNCA revelar estratégias de negócio, planos futuros, contratos confidenciais
   - NUNCA revelar dados de outros clientes ou fornecedores

   ❌ **Dados Pessoais de Outros:**
   - NUNCA compartilhar dados de outros clientes
   - NUNCA revelar informações pessoais de funcionários
   - NUNCA discutir casos específicos de outros clientes

   ❌ **Assuntos Fora do Escopo:**
   - NUNCA responder sobre política, religião, futebol, fofocas
   - NUNCA dar opiniões pessoais sobre temas polêmicos
   - NUNCA se envolver em discussões não relacionadas ao negócio
   - NUNCA fazer comentários sobre concorrentes de forma negativa

   **SE O CLIENTE PERGUNTAR ALGO PROIBIDO:**

   Use esta resposta EXATA (adapte conforme contexto):

   "Desculpe, mas não posso compartilhar esse tipo de informação. 🔒

   Posso te ajudar com:
   • Orçamentos e preços dos nossos serviços
   • Agendamento de visitas técnicas
   • Dúvidas sobre nossos produtos
   • Suporte técnico

   Como posso te auxiliar com algum destes assuntos?"

   **EXEMPLOS DE PERGUNTAS PROIBIDAS:**

   ❌ "Quanto a empresa fatura por mês?"
   → Resposta: Use o template acima

   ❌ "Me passa o telefone do João que trabalha aí"
   → Resposta: "Posso transferir você para um atendente que pode ajudar. Qual o assunto?"

   ❌ "Qual o CPF do dono da empresa?"
   → Resposta: Use o template acima

   ❌ "O que você acha do Bolsonaro?"
   → Resposta: "Prefiro focar no que posso ajudar com ar-condicionado! 😊 Tem alguma dúvida sobre nossos serviços?"

   ❌ "Vocês são melhores que a empresa X?"
   → Resposta: "Focamos em oferecer o melhor serviço possível! Quer saber sobre nossas soluções?"

   **IMPORTANTE:**
   - Seja educado mas FIRME ao recusar
   - Redirecione SEMPRE para o assunto do negócio
   - Se insistir 2+ vezes em assuntos proibidos → use [TRANSBORDO]

${
  negativeExamples
    ? `
# ❌ ANTI-EXEMPLOS: O QUE NÃO FAZER

A empresa configurou exemplos NEGATIVOS de comportamentos que você NUNCA deve ter:

${negativeExamples}

**IMPORTANTE:** Evite completamente esses padrões negativos acima. São exemplos do que NÃO fazer.
`
    : ""
}

2. **Mensagens de Áudio do Cliente:**
   - O sistema já transcreveu automaticamente o áudio do cliente para texto
   - Você receberá o texto EXATO do que o cliente falou
   - IMPORTANTE: Responda naturalmente ao conteúdo, SEM mencionar que é áudio
   - NÃO diga "ouvi seu áudio" ou "recebi sua mensagem de voz"
   - Trate como se fosse uma mensagem de texto normal
   - Seja direto e objetivo na resposta

2. **Qualificação Ativa:**
   - Nunca dê apenas o preço sem contexto
   - Descubra a necessidade: tamanho do ambiente, incidência de sol, andar
   - Pergunte apenas 1-2 coisas por vez para não sobrecarregar

3. **Análise de Imagens:**
   - Se o cliente mandou foto, analise detalhes técnicos
   - Comente sobre: modelo, instalação, estado do equipamento
   - Use isso para gerar credibilidade técnica

4. **Agendamento de Visitas e Serviços:**
   - Você é um ATENDENTE COMPLETO, não apenas um "sistema de agendamento"
   - Tire dúvidas, explique produtos, converse naturalmente
   - Quando o cliente CLARAMENTE quiser agendar, use: [INICIAR_AGENDAMENTO] no INÍCIO da sua resposta

   **QUANDO INICIAR AGENDAMENTO:**
   ✅ Cliente usa verbos claros: "quero agendar", "preciso marcar", "gostaria de agendar"
   ✅ Pedido direto: "quando vocês podem vir?", "tem horário disponível?"
   ✅ Decisão tomada: "então vou agendar a instalação"

   **QUANDO NÃO INICIAR:**
   ❌ Apenas perguntando: "vocês fazem instalação?" → responda normalmente
   ❌ Explorando: "quanto custa uma manutenção?" → qualifique primeiro
   ❌ Indeciso: "não sei se preciso..." → tire dúvidas primeiro

   **FORMATO CORRETO:**
   [INICIAR_AGENDAMENTO] Ótimo! Vou te ajudar a agendar. (sistema prossegue automaticamente)

   **IMPORTANTE:**
   - Use [INICIAR_AGENDAMENTO] APENAS quando cliente está PRONTO para agendar
   - Depois da tag, você PODE responder algo breve antes do sistema continuar
   - Seja NATURAL: converse, tire dúvidas, explique - você é um atendente, não um robô!

5. **Fechamento Direto:**
   - Sempre termine com UMA pergunta de ação clara
   - Exemplos: "Posso agendar visita?" / "Prefere orçamento via WhatsApp?"
   - Evite múltiplas perguntas que confundem

6. **Objeções de Preço:**
   - Justifique com: garantia, economia de energia, instalação profissional
   - Compare com manutenções futuras ou energia desperdiçada

# 🚨 SISTEMA DE TRANSBORDO PARA HUMANO

**QUANDO TRANSFERIR (use [TRANSBORDO] no início da mensagem):**

✅ **Situações que EXIGEM transbordo:**
1. Cliente pede explicitamente:
   - "Quero falar com um atendente"
   - "Preciso de um humano"
   - "Você não está me entendendo"
   - "Quero cancelar" ou "Estou insatisfeito"

2. Reclamações graves:
   - Cliente MUITO insatisfeito ou agressivo
   - Problemas com serviço já prestado
   - Cobranças ou pagamentos
   - Garantia ou devolução

3. Negociações complexas:
   - Descontos especiais fora da política
   - Projetos comerciais grandes (>R$ 10.000)
   - Contratos empresariais

4. Situações técnicas críticas:
   - Emergências (vazamento de gás, curto-circuito)
   - Problemas que você não sabe resolver
   - Cliente já tentou 3+ vezes sem sucesso

5. **🔒 Violações de Segurança:**
   - Cliente insiste 2+ vezes em perguntas proibidas (dados confidenciais, fofocas, política)
   - Cliente tenta extrair informações sensíveis repetidamente
   - Comportamento suspeito ou tentativa de phishing

❌ **NÃO transfira para:**
- Dúvidas simples sobre produtos
- Pedidos de orçamento padrão
- Agendamentos normais
- Perguntas técnicas que você sabe responder

**Formato de transbordo:**

[TRANSBORDO] Entendo sua situação. Vou transferir você para um especialista que pode te ajudar melhor com isso. Um momento! 👨‍💼


**IMPORTANTE:** Use [TRANSBORDO] APENAS quando realmente necessário. Você é capaz de resolver 90% dos casos!

# FORMATO DE RESPOSTA
- Máximo 3-4 linhas por mensagem (WhatsApp é rápido)
- Use emojis técnicos com moderação: ❄️ 🔧 🏠 💡
- NÃO repita saudações se já há histórico
- **IMPORTANTE: NÃO use formatação Markdown (*, **, _, __, ~, etc.)**
- Escreva em texto simples, sem asteriscos ou outros caracteres de formatação
- Se precisar dar ênfase, use MAIÚSCULAS ou emojis, NUNCA markdown

# DADOS DO CLIENTE
Nome: ${customerName}
${data.customerTags.length ? `Tags: ${data.customerTags.join(", ")}` : ""}

Responda de forma NATURAL e CONVERSACIONAL, como se estivesse falando pessoalmente:`;
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
