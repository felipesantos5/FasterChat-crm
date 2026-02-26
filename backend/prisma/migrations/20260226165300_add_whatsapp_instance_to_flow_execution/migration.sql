-- AlterTable
ALTER TABLE "flow_executions" ADD COLUMN "whatsapp_instance_id" TEXT;

-- AddForeignKey
ALTER TABLE "flow_executions" ADD CONSTRAINT "flow_executions_whatsapp_instance_id_fkey" FOREIGN KEY ("whatsapp_instance_id") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
