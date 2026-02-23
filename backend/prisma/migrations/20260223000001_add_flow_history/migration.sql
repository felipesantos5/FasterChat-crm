-- AlterTable
ALTER TABLE "flow_executions" 
  ADD COLUMN IF NOT EXISTS "history" JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;

-- AlterTable
ALTER TABLE "flows" 
  ADD COLUMN IF NOT EXISTS "trigger_type" TEXT DEFAULT 'webhook',
  ADD COLUMN IF NOT EXISTS "webhook_slug" TEXT,
  ADD COLUMN IF NOT EXISTS "last_webhook_payload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "flows_webhook_slug_key" ON "flows"("webhook_slug");
CREATE INDEX IF NOT EXISTS "flow_executions_contact_phone_idx" ON "flow_executions"("contact_phone");
