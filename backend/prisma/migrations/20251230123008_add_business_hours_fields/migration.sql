-- AlterTable
ALTER TABLE "ai_knowledge" ADD COLUMN     "business_hours_end" INTEGER DEFAULT 18,
ADD COLUMN     "business_hours_start" INTEGER DEFAULT 9;
