-- Migration: add_intent_scripts_config
-- Adicionado campo intent_scripts_config ao ai_knowledge para armazenar
-- configurações dos scripts de atendimento por intenção detectada.
-- O campo é um JSONB para performance de queries e flexibilidade de estrutura.

ALTER TABLE "ai_knowledge" ADD COLUMN IF NOT EXISTS "intent_scripts_config" JSONB;
