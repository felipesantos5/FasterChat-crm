-- AlterTable
ALTER TABLE "companies" ADD COLUMN "whatsapp_strategy" TEXT DEFAULT 'RANDOM',
ADD COLUMN "default_whatsapp_instance_id" TEXT;
