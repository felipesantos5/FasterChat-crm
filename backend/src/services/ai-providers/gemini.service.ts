import { GoogleGenerativeAI, Part, Tool, SchemaType } from "@google/generative-ai";
import axios from "axios";

/**
 * ============================================
 * CONFIGURAÇÕES DE RESILIÊNCIA
 * ============================================
 */
const GEMINI_CONFIG = {
  // Timeout para function calls individuais (ms)
  TOOL_CALL_TIMEOUT: 10000,

  // Retry para chamadas à API
  MAX_RETRIES: 3,
  RETRY_BASE_DELAY_MS: 1000,

  // Timeout para download de mídia (ms)
  MEDIA_DOWNLOAD_TIMEOUT: 30000,

  // Log level (production deveria ser 'error' ou 'warn')
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
};

/**
 * Logger com níveis para evitar exposição de dados sensíveis em produção
 */
const logger = {
  debug: (...args: any[]) => {
    if (GEMINI_CONFIG.LOG_LEVEL === 'debug') console.log('[Gemini]', ...args);
  },
  info: (...args: any[]) => {
    if (['debug', 'info'].includes(GEMINI_CONFIG.LOG_LEVEL)) console.log('[Gemini]', ...args);
  },
  warn: (...args: any[]) => {
    if (['debug', 'info', 'warn'].includes(GEMINI_CONFIG.LOG_LEVEL)) console.warn('[Gemini]', ...args);
  },
  error: (...args: any[]) => console.error('[Gemini]', ...args),
};

/**
 * Executa uma promise com timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

/**
 * Sleep helper para retry com backoff
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Definição das Tools (Function Calling) para o Gemini
 * Formato compatível com a API do Gemini usando SchemaType enum
 */
const geminiTools: Tool[] = [
  {
    functionDeclarations: [
      {
        name: "get_available_slots",
        description:
          "Busca os horários DISPONÍVEIS na agenda do Google Calendar. Use SEMPRE que o cliente perguntar sobre horários livres, disponibilidade, ou quando vocês podem atender. Exemplos: 'que horas tem disponível?', 'quais horários estão livres na sexta?', 'quando vocês podem vir?', 'tem horário amanhã?'. Retorna horários REAIS e CONFIRMADOS sem conflitos na agenda.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_type: {
              type: SchemaType.STRING,
              description:
                'Nome do serviço desejado pelo cliente (ex: "instalação", "manutenção", "consulta"). Usado para calcular a duração do atendimento. Se não souber, use "atendimento".',
            },
            preferred_date: {
              type: SchemaType.STRING,
              description:
                'Data preferida pelo cliente no formato YYYY-MM-DD (ex: 2024-12-25). Se o cliente disser "sexta", "amanhã", "dia 15", converta para o formato correto. Se não especificada, busca nos próximos 7 dias.',
            },
          },
          required: [],
        },
      },
      {
        name: "get_product_info",
        description:
          `OBRIGATÓRIO usar esta ferramenta para QUALQUER pergunta sobre produtos, serviços, preços ou o que a empresa oferece.

GATILHOS (use a ferramenta quando o cliente perguntar):
- "vocês vendem/fazem/tem/trabalham com X?"
- "quanto custa/qual o preço de X?"
- "o que é X?" (sobre um serviço)
- "como funciona X?"
- "quais opções/modelos/variações de X?"
- "me fala sobre X"

REGRA: Esta ferramenta retorna informações COMPLETAS incluindo variações e preços calculados. NUNCA responda sobre produtos/serviços sem usar esta ferramenta primeiro.`,
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            query: {
              type: SchemaType.STRING,
              description:
                'Termo de busca extraído da pergunta. Exemplos: "ar condicionado", "instalação", "manutenção", "limpeza split". Use palavras-chave do que o cliente quer saber.',
            },
            category: {
              type: SchemaType.STRING,
              description:
                'Tipo de busca: PRODUCT (produtos físicos), SERVICE (serviços/mão de obra), PRICING (foco em preço).',
            },
          },
          required: ["query"],
        },
      },
      {
        name: "create_appointment",
        description:
          "Cria um agendamento para o cliente quando todos os dados necessários foram coletados: tipo de serviço, data, horário e endereço. Use SOMENTE quando o cliente confirmar explicitamente que deseja agendar.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_type: {
              type: SchemaType.STRING,
              description: "Nome do serviço a ser agendado conforme cadastrado no catálogo.",
            },
            date: {
              type: SchemaType.STRING,
              description: "Data do agendamento no formato YYYY-MM-DD",
            },
            time: {
              type: SchemaType.STRING,
              description: "Horário do agendamento no formato HH:MM (ex: 14:00)",
            },
            address: {
              type: SchemaType.STRING,
              description: "Endereço completo onde o serviço será realizado",
            },
            title: {
              type: SchemaType.STRING,
              description: "Título descritivo do agendamento",
            },
            notes: {
              type: SchemaType.STRING,
              description: "Observações adicionais sobre o agendamento",
            },
          },
          required: ["service_type", "date", "time", "address", "title"],
        },
      },
      {
        name: "calculate_quote",
        description:
          "Calcula orçamento personalizado baseado nas especificações do cliente. Use quando cliente pedir preço específico ou orçamento detalhado.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            service_type: {
              type: SchemaType.STRING,
              description: "Nome do serviço conforme cadastrado no catálogo de produtos/serviços.",
            },
            additional_services: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'Serviços adicionais (ex: "instalação elétrica", "duto extra")',
            },
          },
          required: ["service_type"],
        },
      },
      {
        name: "get_company_policy",
        description:
          "Busca políticas, garantias, formas de pagamento, horário de funcionamento e outras informações institucionais da empresa.",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            policy_type: {
              type: SchemaType.STRING,
              description: "Tipo de política ou informação solicitada. Valores válidos: WARRANTY, PAYMENT, HOURS, CANCELLATION, COVERAGE_AREA.",
            },
          },
          required: ["policy_type"],
        },
      },
    ],
  },
];

interface GenerateResponseParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  imageBase64?: string;
  imageMimeType?: string;
  audioBase64?: string;
  audioMimeType?: string;
  enableTools?: boolean;
  context?: {
    customerId: string;
    companyId: string;
  };
}

class GeminiService {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      logger.warn("GOOGLE_AI_API_KEY not found. Gemini features will be disabled.");
    }
    this.client = new GoogleGenerativeAI(apiKey || "");
    this.model = "gemini-2.0-flash";
  }

  /**
   * Gera resposta usando Gemini com Function Calling e suporte multimodal
   *
   * CONFIGURAÇÕES OTIMIZADAS:
   * - temperature baixa (0.2) para respostas precisas sobre preços/produtos
   * - topP moderado (0.85) para evitar respostas muito variáveis
   * - topK para limitar variabilidade
   */
  async generateResponse(params: GenerateResponseParams): Promise<string> {
    try {
      const {
        systemPrompt,
        userPrompt,
        temperature = 0.2, // Reduzido de 0.4 para maior precisão
        maxTokens = 1024,
        model,
        imageBase64,
        imageMimeType,
        audioBase64,
        audioMimeType,
        enableTools = true,
        context,
      } = params;

      const modelToUse = model || this.model;

      logger.info(`Generating response with ${modelToUse}${enableTools ? " + Function Calling" : ""}`);
      logger.debug(`Config: temp=${temperature}, topP=0.85, maxTokens=${maxTokens}`);

      // Configura o modelo com tools se habilitado
      const generativeModel = this.client.getGenerativeModel({
        model: modelToUse,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
          topP: 0.85, // Reduzido de 0.95 para respostas mais focadas
          topK: 40, // Limita variabilidade nas escolhas de tokens
        },
        tools: enableTools ? geminiTools : undefined,
      });

      // Monta o conteúdo da mensagem
      const parts: Part[] = [];

      // Adiciona texto
      parts.push({ text: userPrompt });

      // Adiciona imagem se fornecida
      if (imageBase64 && imageMimeType) {
        logger.debug("Image detected, adding to request");
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }

      // Adiciona áudio se fornecido
      if (audioBase64 && audioMimeType) {
        logger.debug("Audio detected, adding to request for transcription/analysis");
        parts.push({
          inlineData: {
            mimeType: audioMimeType,
            data: audioBase64,
          },
        });
      }

      // Primeira chamada ao modelo
      let result = await generativeModel.generateContent(parts);
      let response = result.response;

      // Verifica se o modelo quer chamar funções
      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0 && context) {
        logger.info(`AI decided to call ${functionCalls.length} function(s): ${functionCalls.map(fc => fc.name).join(', ')}`);

        // Importa handlers dinamicamente
        const { executeToolCall } = await import("../ai-tools/handlers");

        // Inicia chat para manter contexto
        const chat = generativeModel.startChat({
          history: [
            {
              role: "user",
              parts: parts,
            },
            {
              role: "model",
              parts: response.candidates?.[0].content.parts || [],
            },
          ],
        });

        // Executa cada function call com tratamento de erros individual
        const functionResponses: Part[] = [];
        let hasAnySuccess = false;

        for (const fc of functionCalls) {
          logger.debug(`Executing function: ${fc.name}`);
          logger.debug(`Arguments: ${JSON.stringify(fc.args)}`);

          try {
            // Executa com timeout para evitar travamentos
            const toolResult = await withTimeout(
              executeToolCall(fc.name, fc.args, context),
              GEMINI_CONFIG.TOOL_CALL_TIMEOUT,
              `Tool ${fc.name} timeout after ${GEMINI_CONFIG.TOOL_CALL_TIMEOUT}ms`
            );

            functionResponses.push({
              functionResponse: {
                name: fc.name,
                response: toolResult,
              },
            });
            hasAnySuccess = true;
            logger.debug(`Function ${fc.name} executed successfully`);
          } catch (error: any) {
            // Tratamento de erro gracioso - envia erro ao modelo para resposta adequada
            logger.warn(`Function ${fc.name} failed: ${error.message}`);

            // Monta resposta de erro informativa para o modelo
            const errorResponse = {
              error: true,
              errorType: error.message?.includes('timeout') ? 'TIMEOUT' : 'EXECUTION_ERROR',
              message: this.getGracefulErrorMessage(fc.name, error),
              suggestion: this.getErrorSuggestion(fc.name),
            };

            functionResponses.push({
              functionResponse: {
                name: fc.name,
                response: errorResponse,
              },
            });
          }
        }

        // Envia resultados das funções (incluindo erros) e obtém resposta final
        logger.debug("Sending function results back to model...");

        try {
          result = await withTimeout(
            chat.sendMessage(functionResponses),
            GEMINI_CONFIG.TOOL_CALL_TIMEOUT * 2, // Mais tempo para processar múltiplos resultados
            "Model response timeout after function calls"
          );
          response = result.response;
        } catch (chatError: any) {
          logger.error(`Failed to get response after function calls: ${chatError.message}`);
          // Se falhar ao enviar resultados, tenta gerar resposta sem as tools
          if (hasAnySuccess) {
            throw chatError; // Re-throw se alguma tool teve sucesso
          }
          // Se nenhuma tool funcionou, deixa seguir para retornar erro genérico
        }
      }

      const finalContent = response.text();

      if (!finalContent) {
        throw new Error("No content in Gemini response");
      }

      // Log de uso de tokens (apenas em debug)
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        logger.debug(`Tokens used - Input: ${usageMetadata.promptTokenCount}, Output: ${usageMetadata.candidatesTokenCount}`);

        // Gemini 2.0 Flash pricing (aproximado):
        // - Input: $0.075 / 1M tokens
        // - Output: $0.30 / 1M tokens
        const inputCost = ((usageMetadata.promptTokenCount || 0) / 1_000_000) * 0.075;
        const outputCost = ((usageMetadata.candidatesTokenCount || 0) / 1_000_000) * 0.3;
        const totalCost = inputCost + outputCost;
        logger.debug(`Estimated cost: $${totalCost.toFixed(6)}`);
      }

      return finalContent;
    } catch (error: any) {
      logger.error("Error generating response:", error.message);

      // Tratamento de erros específicos com mensagens amigáveis
      if (error.message?.includes("API_KEY")) {
        throw new Error("Invalid or missing Gemini API key.");
      } else if (error.status === 429 || error.message?.includes("quota")) {
        throw new Error("Gemini API rate limit exceeded. Please try again later.");
      } else if (error.message?.includes("SAFETY")) {
        throw new Error("Content blocked by Gemini safety filters.");
      } else if (error.message?.includes("timeout")) {
        throw new Error("Request timeout. The service is temporarily slow.");
      }

      throw new Error(`Failed to generate Gemini response: ${error.message}`);
    }
  }

  /**
   * Retorna mensagem de erro amigável para o modelo baseado na função que falhou
   */
  private getGracefulErrorMessage(functionName: string, error: any): string {
    const errorMessages: Record<string, string> = {
      get_available_slots: "Não foi possível consultar a agenda no momento. O sistema de agendamentos está temporariamente indisponível.",
      get_product_info: "Não foi possível buscar informações do produto/serviço no momento.",
      create_appointment: "Não foi possível criar o agendamento no momento. Por favor, tente novamente.",
      calculate_quote: "Não foi possível calcular o orçamento no momento.",
      get_company_policy: "Não foi possível buscar as informações da empresa no momento.",
    };

    return errorMessages[functionName] || `A função ${functionName} está temporariamente indisponível.`;
  }

  /**
   * Retorna sugestão de ação para o modelo baseado na função que falhou
   */
  private getErrorSuggestion(functionName: string): string {
    const suggestions: Record<string, string> = {
      get_available_slots: "Informe ao cliente que pode tentar novamente em alguns minutos ou entrar em contato por outro canal.",
      get_product_info: "Use as informações de produtos/serviços disponíveis no contexto do sistema.",
      create_appointment: "Peça ao cliente para confirmar os dados novamente e tente criar o agendamento.",
      calculate_quote: "Informe o preço base do serviço e mencione que o valor final pode variar.",
      get_company_policy: "Use as informações disponíveis no contexto do sistema sobre políticas da empresa.",
    };

    return suggestions[functionName] || "Informe ao cliente que houve um problema técnico temporário.";
  }

  /**
   * Transcreve áudio usando Gemini com retry automático
   * Gemini pode processar áudio diretamente e entender o conteúdo
   */
  async transcribeAudio(audioInput: string, mimeType: string = "audio/ogg"): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
      try {
        logger.debug(`Starting audio transcription (attempt ${attempt}/${GEMINI_CONFIG.MAX_RETRIES})`);

        let audioBase64: string;

        // Detecta se é URL ou base64
        if (audioInput.startsWith("http://") || audioInput.startsWith("https://")) {
          logger.debug("Downloading audio from URL...");
          const response = await axios.get(audioInput, {
            responseType: "arraybuffer",
            timeout: GEMINI_CONFIG.MEDIA_DOWNLOAD_TIMEOUT,
          });
          audioBase64 = Buffer.from(response.data).toString("base64");
          logger.debug(`Audio downloaded: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
        } else {
          // Remove prefixo data:audio/... se presente
          audioBase64 = audioInput.replace(/^data:audio\/[^;]+;base64,/, "");
        }

        // Usa Gemini para transcrever o áudio
        const generativeModel = this.client.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 2048,
          },
        });

        const result = await generativeModel.generateContent([
          {
            text: "Transcreva o áudio a seguir para texto em português brasileiro. Retorne APENAS a transcrição, sem comentários ou explicações adicionais. Se não conseguir entender alguma parte, indique com [inaudível].",
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64,
            },
          },
        ]);

        const transcription = result.response.text().trim();

        if (!transcription || transcription.length < 3) {
          throw new Error("Audio transcription resulted in empty or invalid text");
        }

        logger.info(`Audio transcription completed (${transcription.length} chars)`);
        return transcription;
      } catch (error: any) {
        lastError = error;
        logger.warn(`Transcription attempt ${attempt} failed: ${error.message}`);

        // Se não for o último retry e for erro recuperável, aguarda antes de tentar novamente
        if (attempt < GEMINI_CONFIG.MAX_RETRIES && this.isRetryableError(error)) {
          const delay = GEMINI_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.debug(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }
    }

    logger.error("All transcription attempts failed");
    throw new Error(`Failed to transcribe audio: ${lastError?.message}`);
  }

  /**
   * Analisa uma imagem e retorna descrição com retry automático
   */
  async analyzeImage(imageInput: string, mimeType: string = "image/jpeg", prompt?: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= GEMINI_CONFIG.MAX_RETRIES; attempt++) {
      try {
        logger.debug(`Analyzing image (attempt ${attempt}/${GEMINI_CONFIG.MAX_RETRIES})`);

        let imageBase64: string;

        // Detecta se é URL ou base64
        if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
          logger.debug("Downloading image from URL...");
          const response = await axios.get(imageInput, {
            responseType: "arraybuffer",
            timeout: GEMINI_CONFIG.MEDIA_DOWNLOAD_TIMEOUT,
          });
          imageBase64 = Buffer.from(response.data).toString("base64");
          logger.debug(`Image downloaded: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
        } else {
          // Remove prefixo data:image/... se presente
          imageBase64 = imageInput.replace(/^data:image\/[^;]+;base64,/, "");
        }

        const generativeModel = this.client.getGenerativeModel({
          model: this.model,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          },
        });

        const analysisPrompt =
          prompt ||
          "Descreva detalhadamente o que você vê nesta imagem. Se for um produto, equipamento ou algo relacionado a um serviço, mencione características relevantes como marca, modelo, estado de conservação, possíveis problemas visíveis, etc.";

        const result = await generativeModel.generateContent([
          { text: analysisPrompt },
          {
            inlineData: {
              mimeType: mimeType,
              data: imageBase64,
            },
          },
        ]);

        const analysis = result.response.text().trim();
        logger.info(`Image analysis completed (${analysis.length} chars)`);

        return analysis;
      } catch (error: any) {
        lastError = error;
        logger.warn(`Image analysis attempt ${attempt} failed: ${error.message}`);

        if (attempt < GEMINI_CONFIG.MAX_RETRIES && this.isRetryableError(error)) {
          const delay = GEMINI_CONFIG.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          logger.debug(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
        }
      }
    }

    logger.error("All image analysis attempts failed");
    throw new Error(`Failed to analyze image: ${lastError?.message}`);
  }

  /**
   * Verifica se um erro é recuperável (pode ser retentado)
   */
  private isRetryableError(error: any): boolean {
    // Erros de rede/timeout são recuperáveis
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Rate limit é recuperável (com backoff)
    if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate')) {
      return true;
    }

    // Erros 5xx do servidor são recuperáveis
    if (error.status >= 500 && error.status < 600) {
      return true;
    }

    // Timeout explícito é recuperável
    if (error.message?.includes('timeout')) {
      return true;
    }

    // Erros de API key, segurança, etc. NÃO são recuperáveis
    return false;
  }

  /**
   * Verifica se a API está configurada
   */
  isConfigured(): boolean {
    return !!(process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY);
  }

  /**
   * Testa a conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.model });
      await model.generateContent("test");
      logger.info("Connection test successful");
      return true;
    } catch (error: any) {
      logger.error("Connection test failed:", error.message);
      return false;
    }
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo() {
    return {
      provider: "Google Gemini",
      model: this.model,
      maxTokens: 1048576, // Gemini 1.5 Flash tem janela de contexto de 1M tokens
      pricing: {
        input: "$0.075 / 1M tokens",
        output: "$0.30 / 1M tokens",
        audio: "Incluído no preço por token",
        vision: "Incluído no preço por token",
      },
      features: [
        "Extremamente rápido e econômico",
        "Janela de contexto de 1M tokens",
        "Suporte nativo a áudio (transcrição)",
        "Suporte nativo a imagens (análise)",
        "Function Calling integrado",
        "Integração com Google Calendar",
        "Baixa latência",
        "Ideal para atendimento em escala",
      ],
    };
  }

  /**
   * Obtém o mimeType correto para arquivos de áudio do WhatsApp
   */
  getAudioMimeType(filename?: string): string {
    if (!filename) return "audio/ogg";

    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      ogg: "audio/ogg",
      opus: "audio/ogg",
      mp3: "audio/mp3",
      wav: "audio/wav",
      m4a: "audio/mp4",
      aac: "audio/aac",
      webm: "audio/webm",
    };

    return mimeTypes[ext || ""] || "audio/ogg";
  }

  /**
   * Obtém o mimeType correto para arquivos de imagem
   */
  getImageMimeType(filename?: string): string {
    if (!filename) return "image/jpeg";

    const ext = filename.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      heic: "image/heic",
      heif: "image/heif",
    };

    return mimeTypes[ext || ""] || "image/jpeg";
  }
}

export default new GeminiService();
