ALTER TABLE "flow_executions" ADD COLUMN IF NOT EXISTS "replaced_by_execution_id" TEXT;
ALTER TABLE "flow_executions" ADD COLUMN IF NOT EXISTS "replaced_by_flow_id" TEXT;
