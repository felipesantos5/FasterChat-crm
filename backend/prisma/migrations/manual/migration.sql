-- Migration: Add Semantic Service Tables
-- Description: Adiciona tabelas para busca semântica de serviços
-- Date: 2025-01-21
-- IMPORTANTE: Requer extensão pgvector instalada no PostgreSQL

-- Habilita extensão pgvector (deve já existir se knowledge_vectors foi criada)
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Adiciona novos campos na tabela services
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "equipment_type" TEXT;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "action_type" TEXT;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS "services_equipment_type_idx" ON "services"("equipment_type");
CREATE INDEX IF NOT EXISTS "services_action_type_idx" ON "services"("action_type");

-- 2. Cria tabela service_vectors para embeddings dos serviços
CREATE TABLE IF NOT EXISTS "service_vectors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_vectors_pkey" PRIMARY KEY ("id")
);

-- Criar índices para service_vectors
CREATE INDEX IF NOT EXISTS "service_vectors_company_id_idx" ON "service_vectors"("company_id");
CREATE INDEX IF NOT EXISTS "service_vectors_service_id_idx" ON "service_vectors"("service_id");

-- Criar índice vetorial para busca por similaridade (HNSW é mais rápido para busca)
CREATE INDEX IF NOT EXISTS "service_vectors_embedding_idx" ON "service_vectors" USING hnsw ("embedding" vector_cosine_ops);

-- Adicionar foreign key para services
ALTER TABLE "service_vectors"
DROP CONSTRAINT IF EXISTS "service_vectors_service_id_fkey";
ALTER TABLE "service_vectors"
ADD CONSTRAINT "service_vectors_service_id_fkey"
FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Cria tabela service_relationships para relacionamentos entre serviços
CREATE TABLE IF NOT EXISTS "service_relationships" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_service_id" TEXT NOT NULL,
    "related_service_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "strength" DECIMAL(3,2) NOT NULL DEFAULT 0.5,
    "auto_detected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_relationships_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "service_relationships_source_related_unique" UNIQUE ("source_service_id", "related_service_id")
);

-- Criar índices para service_relationships
CREATE INDEX IF NOT EXISTS "service_relationships_company_id_idx" ON "service_relationships"("company_id");
CREATE INDEX IF NOT EXISTS "service_relationships_source_service_id_idx" ON "service_relationships"("source_service_id");
CREATE INDEX IF NOT EXISTS "service_relationships_related_service_id_idx" ON "service_relationships"("related_service_id");

-- Adicionar foreign keys
ALTER TABLE "service_relationships"
DROP CONSTRAINT IF EXISTS "service_relationships_source_service_id_fkey";
ALTER TABLE "service_relationships"
ADD CONSTRAINT "service_relationships_source_service_id_fkey"
FOREIGN KEY ("source_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_relationships"
DROP CONSTRAINT IF EXISTS "service_relationships_related_service_id_fkey";
ALTER TABLE "service_relationships"
ADD CONSTRAINT "service_relationships_related_service_id_fkey"
FOREIGN KEY ("related_service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Cria tabela domain_synonyms para dicionário de sinônimos
CREATE TABLE IF NOT EXISTS "domain_synonyms" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "canonical_term" TEXT NOT NULL,
    "synonyms" TEXT[] NOT NULL DEFAULT '{}',
    "domain" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "domain_synonyms_pkey" PRIMARY KEY ("id")
);

-- Criar índices para domain_synonyms
CREATE INDEX IF NOT EXISTS "domain_synonyms_company_id_idx" ON "domain_synonyms"("company_id");
CREATE INDEX IF NOT EXISTS "domain_synonyms_canonical_term_idx" ON "domain_synonyms"("canonical_term");

-- ============================================
-- INSERIR SINÔNIMOS PADRÃO
-- ============================================

-- Sinônimos globais (company_id = NULL)
INSERT INTO "domain_synonyms" ("id", "company_id", "canonical_term", "synonyms", "domain", "is_active")
VALUES
  (gen_random_uuid(), NULL, 'ar condicionado', ARRAY['ar frio', 'split', 'climatizador', 'AC', 'ar-condicionado', 'ar', 'arcondicionado'], 'HVAC'),
  (gen_random_uuid(), NULL, 'instalacao', ARRAY['instalar', 'instalação', 'colocar', 'montar', 'montagem', 'colocação'], NULL),
  (gen_random_uuid(), NULL, 'manutencao', ARRAY['manutenção', 'conserto', 'consertar', 'arrumar', 'reparo', 'reparar', 'defeito', 'problema'], NULL),
  (gen_random_uuid(), NULL, 'limpeza', ARRAY['limpar', 'higienização', 'higienizacao', 'higienizar', 'lavagem', 'lavar'], NULL),
  (gen_random_uuid(), NULL, 'BTU', ARRAY['btu', 'btus', '9000', '12000', '18000', '24000', '9k', '12k', '18k', '24k'], 'HVAC'),
  (gen_random_uuid(), NULL, 'preco', ARRAY['preço', 'valor', 'custo', 'quanto custa', 'quanto é', 'quanto fica', 'qual o valor'], NULL),
  (gen_random_uuid(), NULL, 'agendar', ARRAY['marcar', 'reservar', 'horário', 'horario', 'agenda', 'disponibilidade'], NULL)
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICAÇÃO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Tables created: service_vectors, service_relationships, domain_synonyms';
  RAISE NOTICE 'Columns added to services: equipment_type, action_type';
END $$;
