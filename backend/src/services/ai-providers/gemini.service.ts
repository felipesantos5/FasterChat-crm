import { GoogleGenerativeAI, Part, Tool, SchemaType } from "@google/generative-ai";
import axios from "axios";

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
      console.warn("[Gemini] GOOGLE_AI_API_KEY not found. Gemini features will be disabled.");
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

      console.log(`[Gemini] Generating response with ${modelToUse}${enableTools ? " + Function Calling" : ""}`);
      console.log(`[Gemini] Config: temp=${temperature}, topP=0.85, maxTokens=${maxTokens}`);

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
        console.log("[Gemini] Image detected, adding to request");
        parts.push({
          inlineData: {
            mimeType: imageMimeType,
            data: imageBase64,
          },
        });
      }

      // Adiciona áudio se fornecido
      if (audioBase64 && audioMimeType) {
        console.log("[Gemini] Audio detected, adding to request for transcription/analysis");
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
        console.log(`[Gemini] AI decided to call ${functionCalls.length} function(s)`);

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

        // Executa cada function call e envia resultado
        const functionResponses: Part[] = [];

        for (const fc of functionCalls) {
          console.log(`[Gemini] Executing function: ${fc.name}`);
          console.log(`[Gemini] Arguments:`, JSON.stringify(fc.args));

          const toolResult = await executeToolCall(fc.name, fc.args, context);

          functionResponses.push({
            functionResponse: {
              name: fc.name,
              response: toolResult,
            },
          });
        }

        // Envia resultados das funções e obtém resposta final
        console.log("[Gemini] Sending function results back to model...");
        result = await chat.sendMessage(functionResponses);
        response = result.response;
      }

      const finalContent = response.text();

      if (!finalContent) {
        throw new Error("No content in Gemini response");
      }

      // Log de uso de tokens
      const usageMetadata = response.usageMetadata;
      if (usageMetadata) {
        console.log(`[Gemini] Tokens used - Input: ${usageMetadata.promptTokenCount}, Output: ${usageMetadata.candidatesTokenCount}`);

        // Gemini 1.5 Flash pricing (aproximado):
        // - Input: $0.075 / 1M tokens
        // - Output: $0.30 / 1M tokens
        const inputCost = ((usageMetadata.promptTokenCount || 0) / 1_000_000) * 0.075;
        const outputCost = ((usageMetadata.candidatesTokenCount || 0) / 1_000_000) * 0.3;
        const totalCost = inputCost + outputCost;
        console.log(`[Gemini] Estimated cost: $${totalCost.toFixed(6)}`);
      }

      return finalContent;
    } catch (error: any) {
      console.error("[Gemini] Error generating response:", error);

      // Tratamento de erros específicos
      if (error.message?.includes("API_KEY")) {
        throw new Error("Invalid or missing Gemini API key.");
      } else if (error.status === 429 || error.message?.includes("quota")) {
        throw new Error("Gemini API rate limit exceeded. Please try again later.");
      } else if (error.message?.includes("SAFETY")) {
        throw new Error("Content blocked by Gemini safety filters.");
      }

      throw new Error(`Failed to generate Gemini response: ${error.message}`);
    }
  }

  /**
   * Transcreve áudio usando Gemini
   * Gemini pode processar áudio diretamente e entender o conteúdo
   */
  async transcribeAudio(audioInput: string, mimeType: string = "audio/ogg"): Promise<string> {
    try {
      console.log("[Gemini] Starting audio transcription");

      let audioBase64: string;

      // Detecta se é URL ou base64
      if (audioInput.startsWith("http://") || audioInput.startsWith("https://")) {
        console.log("[Gemini] Downloading audio from URL...");
        const response = await axios.get(audioInput, {
          responseType: "arraybuffer",
          timeout: 30000,
        });
        audioBase64 = Buffer.from(response.data).toString("base64");
        console.log(`[Gemini] Audio downloaded: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
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

      console.log(`[Gemini] Audio transcription completed: "${transcription.substring(0, 100)}..."`);
      return transcription;
    } catch (error: any) {
      console.error("[Gemini] Error transcribing audio:", error);
      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Analisa uma imagem e retorna descrição
   */
  async analyzeImage(imageInput: string, mimeType: string = "image/jpeg", prompt?: string): Promise<string> {
    try {
      console.log("[Gemini] Analyzing image...");

      let imageBase64: string;

      // Detecta se é URL ou base64
      if (imageInput.startsWith("http://") || imageInput.startsWith("https://")) {
        console.log("[Gemini] Downloading image from URL...");
        const response = await axios.get(imageInput, {
          responseType: "arraybuffer",
          timeout: 30000,
        });
        imageBase64 = Buffer.from(response.data).toString("base64");
        console.log(`[Gemini] Image downloaded: ${(response.data.byteLength / 1024).toFixed(2)} KB`);
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
      console.log(`[Gemini] Image analysis completed: "${analysis.substring(0, 100)}..."`);

      return analysis;
    } catch (error: any) {
      console.error("[Gemini] Error analyzing image:", error);
      throw new Error(`Failed to analyze image: ${error.message}`);
    }
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
      return true;
    } catch (error) {
      console.error("[Gemini] Connection test failed:", error);
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
