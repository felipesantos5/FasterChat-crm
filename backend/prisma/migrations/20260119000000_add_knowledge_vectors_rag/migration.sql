-- ============================================
-- MIGRAÇÃO: RAG - Knowledge Vectors
-- Habilita busca semântica com pgvector
-- ============================================

-- Habilita a extensão pgvector (requer superuser no primeiro uso)
CREATE EXTENSION IF NOT EXISTS vector;

-- Cria a tabela de vetores de conhecimento
CREATE TABLE "knowledge_vectors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_vectors_pkey" PRIMARY KEY ("id")
);

-- Índice por company_id para filtrar rapidamente
CREATE INDEX "knowledge_vectors_company_id_idx" ON "knowledge_vectors"("company_id");

-- Índice HNSW para busca por similaridade de cosseno (alta performance)
-- m = 16: número de conexões por nó (equilíbrio entre memória e precisão)
-- ef_construction = 64: qualidade da construção do índice
CREATE INDEX "knowledge_vectors_embedding_idx" ON "knowledge_vectors"
USING hnsw ("embedding" vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Comentários para documentação
COMMENT ON TABLE "knowledge_vectors" IS 'Armazena chunks de texto com embeddings para RAG (Retrieval-Augmented Generation)';
COMMENT ON COLUMN "knowledge_vectors"."content" IS 'Conteúdo original do chunk de texto';
COMMENT ON COLUMN "knowledge_vectors"."metadata" IS 'Metadados como fonte, tipo de conteúdo, timestamp original';
COMMENT ON COLUMN "knowledge_vectors"."embedding" IS 'Vetor de embedding de 1536 dimensões (OpenAI text-embedding-3-small ou Gemini text-embedding-004)';
