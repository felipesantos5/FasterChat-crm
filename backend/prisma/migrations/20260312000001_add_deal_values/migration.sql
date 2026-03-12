-- CreateTable
CREATE TABLE "deal_values" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "stage_id" TEXT NOT NULL,
    "value" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "closed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_values_company_id_idx" ON "deal_values"("company_id");

-- CreateIndex
CREATE INDEX "deal_values_customer_id_idx" ON "deal_values"("customer_id");

-- CreateIndex
CREATE INDEX "deal_values_stage_id_idx" ON "deal_values"("stage_id");

-- CreateIndex
CREATE INDEX "deal_values_closed_at_idx" ON "deal_values"("closed_at");

-- AddForeignKey
ALTER TABLE "deal_values" ADD CONSTRAINT "deal_values_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_values" ADD CONSTRAINT "deal_values_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "pipeline_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
