-- Adiciona valor FREE ao enum PlanTier
-- ATENÇÃO: ALTER TYPE ADD VALUE não pode ser executado dentro de uma transação
-- no PostgreSQL. O Prisma executa esta migration fora do bloco BEGIN/COMMIT.
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'FREE';
