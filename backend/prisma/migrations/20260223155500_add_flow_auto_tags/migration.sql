-- AlterTable
ALTER TABLE "flows" ADD COLUMN "auto_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
