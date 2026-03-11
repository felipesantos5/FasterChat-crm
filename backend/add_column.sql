ALTER TABLE "flows" ADD COLUMN "whatsapp_instance_id" TEXT;
ALTER TABLE "flows" ADD CONSTRAINT "flows_whatsapp_instance_id_fkey" FOREIGN KEY ("whatsapp_instance_id") REFERENCES "whatsapp_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
