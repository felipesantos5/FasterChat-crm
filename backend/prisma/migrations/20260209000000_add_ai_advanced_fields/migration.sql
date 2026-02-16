-- Migration: Add AI Advanced Fields
-- Description: Adiciona campos avançados de configuração da IA (tone, proactivity, closing focus)
-- Date: 2026-02-09

-- Adiciona novos campos de configuração avançada da IA
ALTER TABLE "ai_knowledge" ADD COLUMN IF NOT EXISTS "ai_tone" TEXT DEFAULT 'professional';
ALTER TABLE "ai_knowledge" ADD COLUMN IF NOT EXISTS "ai_proactivity" TEXT DEFAULT 'medium';
ALTER TABLE "ai_knowledge" ADD COLUMN IF NOT EXISTS "ai_closing_focus" BOOLEAN DEFAULT false;
ALTER TABLE "ai_knowledge" ADD COLUMN IF NOT EXISTS "ai_custom_instructions" TEXT;

-- Comentários explicativos
COMMENT ON COLUMN "ai_knowledge"."ai_tone" IS 'Tom de voz da IA: professional, friendly, casual, formal';
COMMENT ON COLUMN "ai_knowledge"."ai_proactivity" IS 'Nível de proatividade: low, medium, high';
COMMENT ON COLUMN "ai_knowledge"."ai_closing_focus" IS 'Se deve focar em fechar vendas';
COMMENT ON COLUMN "ai_knowledge"."ai_custom_instructions" IS 'Instruções personalizadas adicionais';
