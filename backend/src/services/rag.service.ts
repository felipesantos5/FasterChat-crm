import { prisma } from "../utils/prisma";
import openaiService from "./ai-providers/openai.service";
import geminiService from "./ai-providers/gemini.service";
import { AIProvider } from "../types/ai-provider";

/**
 * ============================================
 * RAG SERVICE - Retrieval-Augmented Generation
 * ============================================
 *
 * Serviço responsável por:
 * 1. Processar textos e gerar embeddings
 * 2. Armazenar chunks vetorizados no banco (pgvector)
 * 3. Realizar buscas semânticas por similaridade
 */

// Configurações do chunking
const RAG_CONFIG = {
  // Tamanho alvo do chunk em caracteres
  CHUNK_SIZE: 800,
  // Sobreposição entre chunks (10%)
  CHUNK_OVERLAP: 80,
  // Tamanho mínimo de chunk válido
  MIN_CHUNK_SIZE: 50,
  // Limite de resultados padrão
  DEFAULT_SEARCH_LIMIT: 5,
  // Threshold de similaridade (0-1, quanto maior mais restritivo)
  SIMILARITY_THRESHOLD: 0.7,
};

// Provider padrão para embeddings (via .env)
const EMBEDDING_PROVIDER: AIProvider =
  (process.env.EMBEDDING_PROVIDER as AIProvider) ||
  (process.env.AI_PROVIDER as AIProvider) ||
  "openai"; // OpenAI tem embeddings mais precisos

interface ChunkMetadata {
  source: string;
  type: "company_description" | "products_services" | "faq" | "policies" | "custom";
  chunkIndex: number;
  totalChunks: number;
  originalLength: number;
  createdAt: string;
}

interface SearchResult {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  similarity: number;
}

class RAGService {
  /**
   * Obtém o serviço de embeddings baseado no provider configurado
   */
  private getEmbeddingService() {
    switch (EMBEDDING_PROVIDER) {
      case "openai":
        console.log("[RAG] Using OpenAI for embeddings");
        return openaiService;
      case "gemini":
        console.log("[RAG] Using Gemini for embeddings");
        return geminiService;
      default:
        console.log("[RAG] Defaulting to OpenAI for embeddings");
        return openaiService;
    }
  }

  /**
   * Divide um texto em chunks com sobreposição
   * Usa uma estratégia inteligente para quebrar em pontos naturais (parágrafos, frases)
   *
   * @param text - Texto para dividir
   * @param chunkSize - Tamanho alvo do chunk
   * @param overlap - Quantidade de sobreposição
   * @returns Array de chunks
   */
  private splitIntoChunks(
    text: string,
    chunkSize: number = RAG_CONFIG.CHUNK_SIZE,
    overlap: number = RAG_CONFIG.CHUNK_OVERLAP
  ): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    // Normaliza o texto
    const normalizedText = text
      .replace(/\r\n/g, "\n")
      .replace(/\s+/g, " ")
      .trim();

    if (normalizedText.length <= chunkSize) {
      return [normalizedText];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < normalizedText.length) {
      let endIndex = startIndex + chunkSize;

      // Se não chegou ao final, tenta encontrar um ponto de quebra natural
      if (endIndex < normalizedText.length) {
        // Procura por pontos de quebra naturais (em ordem de preferência)
        const breakPoints = ["\n\n", ".\n", ". ", "! ", "? ", ", ", " "];

        for (const breakPoint of breakPoints) {
          const lastBreak = normalizedText.lastIndexOf(
            breakPoint,
            endIndex
          );

          // Só usa se estiver dentro de um range razoável
          if (lastBreak > startIndex + chunkSize * 0.5) {
            endIndex = lastBreak + breakPoint.length;
            break;
          }
        }
      }

      // Extrai o chunk
      const chunk = normalizedText.slice(startIndex, endIndex).trim();

      if (chunk.length >= RAG_CONFIG.MIN_CHUNK_SIZE) {
        chunks.push(chunk);
      }

      // Move o início considerando overlap
      startIndex = endIndex - overlap;

      // Evita loop infinito
      if (startIndex >= normalizedText.length - RAG_CONFIG.MIN_CHUNK_SIZE) {
        break;
      }
    }

    return chunks;
  }

  /**
   * Processa um texto, gera embeddings e armazena no banco
   *
   * @param companyId - ID da empresa
   * @param text - Texto para processar
   * @param metadata - Metadados adicionais
   */
  async processAndStore(
    companyId: string,
    text: string,
    metadata: Partial<ChunkMetadata>
  ): Promise<{ chunksProcessed: number; success: boolean }> {
    if (!text || text.trim().length === 0) {
      console.log("[RAG] Empty text provided, skipping processing");
      return { chunksProcessed: 0, success: true };
    }

    try {
      console.log(`[RAG] Processing text for company ${companyId}`);
      console.log(`[RAG] Text length: ${text.length} characters`);

      // Divide em chunks
      const chunks = this.splitIntoChunks(text);
      console.log(`[RAG] Created ${chunks.length} chunks`);

      if (chunks.length === 0) {
        return { chunksProcessed: 0, success: true };
      }

      // Gera embeddings em paralelo
      const embeddingService = this.getEmbeddingService();
      console.log(`[RAG] Generating embeddings for ${chunks.length} chunks...`);

      const embeddings = await embeddingService.generateEmbeddings(chunks);

      // Prepara os dados para inserção
      const timestamp = new Date().toISOString();

      // Usa transação para garantir consistência
      await prisma.$transaction(async (tx) => {
        // Remove chunks antigos do mesmo tipo/fonte (se for uma atualização)
        if (metadata.source) {
          await tx.$executeRaw`
            DELETE FROM knowledge_vectors
            WHERE company_id = ${companyId}
            AND metadata->>'source' = ${metadata.source}
          `;
          console.log(`[RAG] Removed old chunks for source: ${metadata.source}`);
        }

        // Insere novos chunks
        for (let i = 0; i < chunks.length; i++) {
          const chunkMetadata: ChunkMetadata = {
            source: metadata.source || "unknown",
            type: metadata.type || "custom",
            chunkIndex: i,
            totalChunks: chunks.length,
            originalLength: text.length,
            createdAt: timestamp,
          };

          // Converte embedding para formato pgvector
          const embeddingVector = `[${embeddings[i].join(",")}]`;

          await tx.$executeRaw`
            INSERT INTO knowledge_vectors (id, company_id, content, metadata, embedding, created_at, updated_at)
            VALUES (
              gen_random_uuid(),
              ${companyId},
              ${chunks[i]},
              ${JSON.stringify(chunkMetadata)}::jsonb,
              ${embeddingVector}::vector,
              NOW(),
              NOW()
            )
          `;
        }
      });

      console.log(`[RAG] Successfully stored ${chunks.length} chunks`);

      return { chunksProcessed: chunks.length, success: true };
    } catch (error: any) {
      console.error("[RAG] Error processing and storing:", error);
      throw new Error(`Failed to process and store text: ${error.message}`);
    }
  }

  /**
   * Busca conteúdo similar usando busca vetorial
   *
   * @param companyId - ID da empresa (filtro obrigatório para isolamento)
   * @param query - Texto da consulta
   * @param limit - Número máximo de resultados
   * @returns Array de resultados ordenados por similaridade
   */
  async searchSimilarContent(
    companyId: string,
    query: string,
    limit: number = RAG_CONFIG.DEFAULT_SEARCH_LIMIT
  ): Promise<SearchResult[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      console.log(`[RAG] Searching for company ${companyId}: "${query.substring(0, 50)}..."`);

      // Gera embedding da query
      const embeddingService = this.getEmbeddingService();
      const queryEmbedding = await embeddingService.generateEmbedding(query);

      // Converte para formato pgvector
      const queryVector = `[${queryEmbedding.join(",")}]`;

      // Busca por similaridade de cosseno (1 - distância = similaridade)
      // O operador <=> retorna a distância de cosseno, menor = mais similar
      const results = await prisma.$queryRaw<
        Array<{
          id: string;
          content: string;
          metadata: any;
          similarity: number;
        }>
      >`
        SELECT
          id,
          content,
          metadata,
          1 - (embedding <=> ${queryVector}::vector) as similarity
        FROM knowledge_vectors
        WHERE company_id = ${companyId}
        AND 1 - (embedding <=> ${queryVector}::vector) >= ${RAG_CONFIG.SIMILARITY_THRESHOLD}
        ORDER BY embedding <=> ${queryVector}::vector
        LIMIT ${limit}
      `;

      console.log(`[RAG] Found ${results.length} relevant results`);

      // Formata os resultados
      return results.map((row) => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata as ChunkMetadata,
        similarity: Number(row.similarity),
      }));
    } catch (error: any) {
      console.error("[RAG] Error searching similar content:", error);
      // Em caso de erro, retorna array vazio para não quebrar o fluxo
      return [];
    }
  }

  /**
   * Remove todos os vetores de uma empresa
   * Útil para reset ou exclusão de conta
   *
   * @param companyId - ID da empresa
   */
  async clearCompanyVectors(companyId: string): Promise<void> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM knowledge_vectors WHERE company_id = ${companyId}
      `;
      console.log(`[RAG] Cleared vectors for company ${companyId}: ${result} rows deleted`);
    } catch (error: any) {
      console.error("[RAG] Error clearing company vectors:", error);
      throw new Error(`Failed to clear vectors: ${error.message}`);
    }
  }

  /**
   * Remove vetores por fonte específica
   * Útil para atualizar um tipo específico de conhecimento
   *
   * @param companyId - ID da empresa
   * @param source - Fonte/identificador do conteúdo
   */
  async clearBySource(companyId: string, source: string): Promise<void> {
    try {
      const result = await prisma.$executeRaw`
        DELETE FROM knowledge_vectors
        WHERE company_id = ${companyId}
        AND metadata->>'source' = ${source}
      `;
      console.log(`[RAG] Cleared vectors for source ${source}: ${result} rows deleted`);
    } catch (error: any) {
      console.error("[RAG] Error clearing vectors by source:", error);
    }
  }

  /**
   * Obtém estatísticas dos vetores de uma empresa
   *
   * @param companyId - ID da empresa
   */
  async getStats(companyId: string): Promise<{
    totalVectors: number;
    byType: Record<string, number>;
  }> {
    try {
      const total = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM knowledge_vectors WHERE company_id = ${companyId}
      `;

      const byType = await prisma.$queryRaw<Array<{ type: string; count: bigint }>>`
        SELECT metadata->>'type' as type, COUNT(*) as count
        FROM knowledge_vectors
        WHERE company_id = ${companyId}
        GROUP BY metadata->>'type'
      `;

      const typeStats: Record<string, number> = {};
      for (const row of byType) {
        typeStats[row.type || "unknown"] = Number(row.count);
      }

      return {
        totalVectors: Number(total[0]?.count || 0),
        byType: typeStats,
      };
    } catch (error: any) {
      console.error("[RAG] Error getting stats:", error);
      return { totalVectors: 0, byType: {} };
    }
  }

  /**
   * Processa todo o conhecimento de uma empresa (companyDescription, productsServices, FAQ, etc.)
   * Método de conveniência para reprocessar toda a base de conhecimento
   *
   * @param companyId - ID da empresa
   * @param knowledge - Objeto com os campos de conhecimento
   */
  async processKnowledge(
    companyId: string,
    knowledge: {
      companyDescription?: string | null;
      productsServices?: string | null;
      policies?: string | null;
      faq?: Array<{ question: string; answer: string }> | null;
    }
  ): Promise<{ totalChunks: number }> {
    let totalChunks = 0;

    // Processa descrição da empresa
    if (knowledge.companyDescription) {
      const result = await this.processAndStore(
        companyId,
        knowledge.companyDescription,
        { source: "company_description", type: "company_description" }
      );
      totalChunks += result.chunksProcessed;
    }

    // Processa produtos/serviços
    if (knowledge.productsServices) {
      const result = await this.processAndStore(
        companyId,
        knowledge.productsServices,
        { source: "products_services", type: "products_services" }
      );
      totalChunks += result.chunksProcessed;
    }

    // Processa políticas
    if (knowledge.policies) {
      const result = await this.processAndStore(companyId, knowledge.policies, {
        source: "policies",
        type: "policies",
      });
      totalChunks += result.chunksProcessed;
    }

    // Processa FAQ (cada par pergunta/resposta como um chunk)
    if (knowledge.faq && knowledge.faq.length > 0) {
      const faqText = knowledge.faq
        .map((item) => `Pergunta: ${item.question}\nResposta: ${item.answer}`)
        .join("\n\n");

      const result = await this.processAndStore(companyId, faqText, {
        source: "faq",
        type: "faq",
      });
      totalChunks += result.chunksProcessed;
    }

    console.log(`[RAG] Processed knowledge for company ${companyId}: ${totalChunks} total chunks`);

    return { totalChunks };
  }
}

export const ragService = new RAGService();
export default ragService;
