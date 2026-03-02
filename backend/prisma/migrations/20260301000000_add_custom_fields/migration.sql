-- Add missing state column to customers
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "state" TEXT;

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_custom_field_values" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_definitions_name_key" ON "custom_field_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_custom_field_values_customer_id_field_id_key" ON "customer_custom_field_values"("customer_id", "field_id");

-- AddForeignKey
ALTER TABLE "customer_custom_field_values" ADD CONSTRAINT "customer_custom_field_values_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_custom_field_values" ADD CONSTRAINT "customer_custom_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
