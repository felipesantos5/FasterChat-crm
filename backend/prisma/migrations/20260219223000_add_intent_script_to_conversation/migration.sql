-- AlterTable: Adiciona estado do script de atendimento ativo na conversa
ALTER TABLE "conversations" 
  ADD COLUMN "active_intent_script_id" TEXT,
  ADD COLUMN "intent_script_collected_data" JSONB;
