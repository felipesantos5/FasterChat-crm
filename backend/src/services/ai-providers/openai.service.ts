import OpenAI, { toFile } from "openai";
import axios from "axios";
import { ChatCompletionTool, ChatCompletionMessageParam } from "openai/resources/chat/completions";

interface GenerateResponseParams {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  imageUrl?: string;
  tools?: ChatCompletionTool[];
  toolChoice?: "auto" | "none" | "required";
  context?: {
    customerId: string;
    companyId: string;
  };
  // Parâmetros avançados de geração
  presencePenalty?: number;
  frequencyPenalty?: number;
}

class OpenAIService {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OPENAI_API_KEY not found in environment variables. OpenAI features will be disabled.");
    }
    this.client = new OpenAI({
      apiKey: apiKey || "",
    });
    this.model = process.env.OPENAI_MODEL_MINI || "gpt-4o-mini";
  }

  /**
   * Gera resposta usando GPT-4o Mini com otimizações e Function Calling
   */
  async generateResponse(params: GenerateResponseParams): Promise<string> {
    try {
      const {
        systemPrompt,
        userPrompt,
        temperature = 0.4,
        maxTokens = 400,
        model,
        imageUrl,
        tools,
        toolChoice = "auto",
        context,
        presencePenalty = 0.1,
        frequencyPenalty = 0.1,
      } = params;

      const modelToUse = model || this.model;

      console.log(`[OpenAI] Generating response with ${modelToUse}${tools ? ` + ${tools.length} tools` : ""}`);

      // Se há imagem, usa GPT-4o (Vision) ao invés do Mini
      const visionModel = imageUrl ? "gpt-4o" : modelToUse;

      if (imageUrl) {
        console.log("[OpenAI] Image detected, using GPT-4o Vision capabilities");
      }

      // Prepara o conteúdo da mensagem do usuário
      const userContent: Array<any> = [];

      if (imageUrl) {
        // Formato para Vision API
        userContent.push({
          type: "text",
          text: userPrompt,
        });
        userContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        });
      }

      // Prepara mensagens
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: imageUrl ? userContent : userPrompt,
        },
      ];

      // Configuração base da requisição
      const requestConfig: any = {
        model: visionModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: 0.95,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      };

      // Adiciona tools se fornecidas
      if (tools && tools.length > 0) {
        requestConfig.tools = tools;
        requestConfig.tool_choice = toolChoice;
      }

      // Primeira chamada à API
      let response = await this.client.chat.completions.create(requestConfig);

      let finalContent = response.choices[0]?.message?.content || "";
      const toolCalls = response.choices[0]?.message?.tool_calls;

      // Se a IA decidiu chamar tools
      if (toolCalls && toolCalls.length > 0 && context) {
        console.log(`[OpenAI] AI decided to call ${toolCalls.length} tool(s)`);

        // Importa handlers dinamicamente para evitar dependência circular
        const { executeToolCall } = await import("../ai-tools/handlers");

        // Adiciona mensagem da IA (com tool_calls) ao histórico
        messages.push(response.choices[0].message);

        // Executa cada tool call
        for (const toolCall of toolCalls) {
          const functionName = (toolCall as any).function.name;
          const functionArgs = JSON.parse((toolCall as any).function.arguments);

          console.log(`[OpenAI] Executing tool: ${functionName}`);

          // Executa a função
          const toolResult = await executeToolCall(functionName, functionArgs, context);

          // Adiciona resultado da tool ao histórico
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }

        // Segunda chamada à API com os resultados das tools
        console.log("[OpenAI] Generating final response with tool results...");
        response = await this.client.chat.completions.create({
          model: visionModel,
          messages,
          temperature,
          max_tokens: maxTokens,
        });

        finalContent = response.choices[0]?.message?.content || "";
      }

      if (!finalContent) {
        throw new Error("No content in OpenAI response");
      }

      console.log(`[OpenAI] Response generated successfully. Tokens used: ${response.usage?.total_tokens || "unknown"}`);

      // Log de custo aproximado (GPT-4o Mini é ~$0.15/1M input tokens, ~$0.60/1M output tokens)
      if (response.usage) {
        const inputCost = (response.usage.prompt_tokens / 1_000_000) * 0.15;
        const outputCost = (response.usage.completion_tokens / 1_000_000) * 0.6;
        const totalCost = inputCost + outputCost;
        console.log(`[OpenAI] Estimated cost: $${totalCost.toFixed(6)}`);
      }

      return finalContent;
    } catch (error: any) {
      console.error("[OpenAI] Error generating response:", error);

      // Tratamento de erros específicos da OpenAI
      if (error.code === "insufficient_quota") {
        throw new Error("OpenAI API quota exceeded. Please check your billing.");
      } else if (error.code === "invalid_api_key") {
        throw new Error("Invalid OpenAI API key.");
      } else if (error.status === 429) {
        throw new Error("OpenAI API rate limit exceeded. Please try again later.");
      }

      throw new Error(`Failed to generate OpenAI response: ${error.message}`);
    }
  }

  /**
   * Baixa áudio de uma URL
   * @param url - URL do áudio
   * @returns Buffer do áudio
   */
  private async downloadAudioFromUrl(url: string): Promise<Buffer> {
    try {
      console.log("[OpenAI] 🌐 Downloading audio from URL...");

      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 30000, // 30 segundos
      });

      const audioBuffer = Buffer.from(response.data);
      console.log(`[OpenAI] ✅ Audio downloaded: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

      return audioBuffer;
    } catch (error: any) {
      console.error("[OpenAI] ❌ Failed to download audio from URL:", error.message);
      throw new Error(`Failed to download audio: ${error.message}`);
    }
  }

  /**
   * Transcreve áudio usando Whisper API (aceita base64 ou URL)
   * @param audioInput - Áudio em formato base64 OU URL
   * @returns Texto transcrito
   */
  async transcribeAudio(audioInput: string): Promise<string> {
    try {
      console.log("[OpenAI] 🎤 Starting audio transcription with Whisper API");

      let audioBuffer: Buffer;

      // Detecta se é URL ou base64
      if (audioInput.startsWith("http://") || audioInput.startsWith("https://")) {
        // É uma URL - faz download
        console.log("[OpenAI] 🔗 Audio input is URL");
        audioBuffer = await this.downloadAudioFromUrl(audioInput);
      } else {
        // É base64 - decodifica
        console.log("[OpenAI] 📦 Audio input is base64");
        const base64Data = audioInput.replace(/^data:audio\/[^;]+;base64,/, "");
        audioBuffer = Buffer.from(base64Data, "base64");
      }

      console.log(`[OpenAI] 📦 Audio buffer size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

      // Valida o tamanho do buffer
      if (audioBuffer.length === 0) {
        throw new Error("Audio buffer is empty");
      }

      // CORREÇÃO: Usa toFile() para criar um objeto File-like sem filesystem
      // A OpenAI API aceita diversos formatos: mp3, mp4, mpeg, mpga, m4a, wav, webm, ogg
      // WhatsApp geralmente envia em formato OGG (Opus codec)
      const audioFile = await toFile(audioBuffer, "audio.ogg", {
        type: "audio/ogg; codecs=opus",
      });

      console.log("[OpenAI] 📄 Audio file object created successfully");

      // Chama a Whisper API para transcrição
      const transcription = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "pt", // Português brasileiro
        response_format: "text",
        temperature: 0, // 0 = mais preciso, menos criativo
        // Prompt opcional para melhorar contexto (Whisper usa isso como referência)
        prompt: "Conversa de atendimento ao cliente via WhatsApp. Cliente falando em português brasileiro sobre produtos, serviços, dúvidas ou agendamentos.",
      });

      // Limpa a transcrição
      const cleanedTranscription = (transcription as string)
        .trim()
        .replace(/\s+/g, " ") // Remove espaços múltiplos
        .replace(/\n+/g, " "); // Remove quebras de linha

      console.log("[OpenAI] ✅ Audio transcription completed successfully");
      console.log(`[OpenAI] 📝 Transcription (${cleanedTranscription.length} chars): "${cleanedTranscription}"`);

      // Se a transcrição estiver vazia ou muito curta, pode ser ruído
      if (cleanedTranscription.length < 3) {
        console.warn("[OpenAI] ⚠️ Transcription too short, might be noise");
        throw new Error("Audio transcription resulted in empty or invalid text");
      }

      return cleanedTranscription;
    } catch (error: any) {
      console.error("[OpenAI] ❌ Error transcribing audio:", error);

      // Log detalhado do erro para debug
      if (error.response) {
        console.error("[OpenAI] Error response:", JSON.stringify(error.response.data, null, 2));
      }

      // Tratamento de erros específicos
      if (error.code === "insufficient_quota") {
        throw new Error("OpenAI API quota exceeded. Please check your billing.");
      } else if (error.code === "invalid_api_key") {
        throw new Error("Invalid OpenAI API key.");
      } else if (error.status === 429) {
        throw new Error("OpenAI API rate limit exceeded. Please try again later.");
      } else if (error.message?.includes("invalid_file") || error.message?.includes("Invalid file format")) {
        throw new Error("Invalid audio format. Please try sending the audio again.");
      }

      throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
  }

  /**
   * Verifica se a API da OpenAI está configurada
   */
  isConfigured(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Testa a conexão com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });
      return true;
    } catch (error) {
      console.error("[OpenAI] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Retorna informações sobre o modelo
   */
  getModelInfo() {
    return {
      provider: "OpenAI",
      model: this.model,
      maxTokens: 16384, // GPT-4o Mini context window
      pricing: {
        input: "$0.15 / 1M tokens",
        output: "$0.60 / 1M tokens",
        whisper: "$0.006 / minute",
        vision: "GPT-4o pricing applies",
        embedding: "$0.02 / 1M tokens",
      },
      features: [
        "Rápido e econômico",
        "Ideal para atendimento em escala",
        "Baixa latência",
        "Boa qualidade para conversas simples",
        "Transcrição de áudio com Whisper API",
        "Análise de imagens com GPT-4o Vision",
        "Embeddings com text-embedding-3-small",
      ],
    };
  }

  /**
   * Gera embedding de texto usando o modelo text-embedding-3-small da OpenAI
   * Retorna um vetor de 1536 dimensões para uso com pgvector
   *
   * @param text - Texto para gerar embedding
   * @returns Array de números representando o embedding
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      throw new Error("Text cannot be empty for embedding generation");
    }

    try {
      console.log("[OpenAI] Generating embedding...");

      const response = await this.client.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        dimensions: 1536, // Fixa em 1536 dimensões para compatibilidade
      });

      const embedding = response.data[0].embedding;

      if (!embedding || embedding.length === 0) {
        throw new Error("Empty embedding returned from OpenAI");
      }

      console.log(`[OpenAI] Embedding generated: ${embedding.length} dimensions`);

      // Log de custo aproximado (text-embedding-3-small: ~$0.02/1M tokens)
      if (response.usage) {
        const cost = (response.usage.total_tokens / 1_000_000) * 0.02;
        console.log(`[OpenAI] Embedding cost: $${cost.toFixed(6)} (${response.usage.total_tokens} tokens)`);
      }

      return embedding;
    } catch (error: any) {
      console.error("[OpenAI] Error generating embedding:", error);

      if (error.code === "insufficient_quota") {
        throw new Error("OpenAI API quota exceeded. Please check your billing.");
      } else if (error.code === "invalid_api_key") {
        throw new Error("Invalid OpenAI API key.");
      } else if (error.status === 429) {
        throw new Error("OpenAI API rate limit exceeded. Please try again later.");
      }

      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Gera embeddings para múltiplos textos em uma única chamada (batch)
   * Mais eficiente que chamar generateEmbedding múltiplas vezes
   *
   * @param texts - Array de textos para gerar embeddings
   * @returns Array de embeddings
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    try {
      console.log(`[OpenAI] Generating embeddings for ${texts.length} texts (batch)...`);

      // OpenAI suporta batch de até 2048 textos por chamada
      const BATCH_SIZE = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += BATCH_SIZE) {
        const batch = texts.slice(i, i + BATCH_SIZE);

        const response = await this.client.embeddings.create({
          model: "text-embedding-3-small",
          input: batch,
          dimensions: 1536,
        });

        // Ordena por índice para garantir a ordem correta
        const sortedData = response.data.sort((a, b) => a.index - b.index);
        const batchEmbeddings = sortedData.map(item => item.embedding);
        results.push(...batchEmbeddings);

        // Log de progresso
        console.log(`[OpenAI] Processed ${Math.min(i + BATCH_SIZE, texts.length)}/${texts.length} texts`);
      }

      console.log(`[OpenAI] Generated ${results.length} embeddings successfully`);
      return results;
    } catch (error: any) {
      console.error("[OpenAI] Error generating batch embeddings:", error);
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }
}

export default new OpenAIService();
