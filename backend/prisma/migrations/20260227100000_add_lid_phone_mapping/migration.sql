-- AlterTable: Add lidPhone to customers for LID↔phone mapping
ALTER TABLE "customers" ADD COLUMN "lid_phone" TEXT;

-- AlterTable: Add contactLid to flow_executions for LID↔phone mapping
ALTER TABLE "flow_executions" ADD COLUMN "contact_lid" TEXT;

-- CreateIndex: Index on lidPhone for fast lookups
CREATE INDEX "customers_lid_phone_idx" ON "customers"("lid_phone");
