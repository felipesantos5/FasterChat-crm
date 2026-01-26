-- AlterTable
ALTER TABLE "ai_knowledge" ADD COLUMN     "pricing_behavior" TEXT DEFAULT 'SHOW_IMMEDIATELY',
ADD COLUMN     "tone_of_voice" TEXT DEFAULT 'FRIENDLY',
ADD COLUMN     "consultative_mode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "required_info_before_quote" JSONB DEFAULT '[]',
ADD COLUMN     "custom_greeting" TEXT,
ADD COLUMN     "custom_qualifying_questions" JSONB DEFAULT '[]';
