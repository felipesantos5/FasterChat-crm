-- AlterTable
ALTER TABLE "customers" ADD COLUMN "is_archived" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "customers_is_archived_idx" ON "customers"("is_archived");

-- Mark "Fechado - Perdido" as fixed for all companies
UPDATE "pipeline_stages" SET "is_fixed" = true WHERE "name" = 'Fechado - Perdido';

-- Mark "Fechado - Ganho" as fixed for all companies
UPDATE "pipeline_stages" SET "is_fixed" = true WHERE "name" = 'Fechado - Ganho';
