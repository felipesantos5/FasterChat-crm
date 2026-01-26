-- Script para verificar e corrigir a migração falha
-- Execute este script dentro do container do PostgreSQL

-- 1. Verificar se as tabelas foram criadas
SELECT
  table_name
FROM
  information_schema.tables
WHERE
  table_schema = 'public'
  AND table_name IN ('service_vectors', 'service_relationships', 'domain_synonyms');

-- 2. Verificar se as colunas foram adicionadas em services
SELECT
  column_name
FROM
  information_schema.columns
WHERE
  table_name = 'services'
  AND column_name IN ('equipment_type', 'action_type');

-- 3. Verificar o estado da migração na tabela _prisma_migrations
SELECT
  migration_name,
  finished_at,
  started_at,
  applied_steps_count,
  logs
FROM
  "_prisma_migrations"
WHERE
  migration_name = '20260121000000_add_semantic_service_tables';
