-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "type" "ServiceType" NOT NULL DEFAULT 'SERVICE',
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variables" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_variables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_variable_options" (
    "id" TEXT NOT NULL,
    "variable_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_modifier" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_variable_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "services_company_id_idx" ON "services"("company_id");

-- CreateIndex
CREATE INDEX "services_is_active_idx" ON "services"("is_active");

-- CreateIndex
CREATE INDEX "services_type_idx" ON "services"("type");

-- CreateIndex
CREATE INDEX "service_variables_service_id_idx" ON "service_variables"("service_id");

-- CreateIndex
CREATE INDEX "service_variable_options_variable_id_idx" ON "service_variable_options"("variable_id");

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variables" ADD CONSTRAINT "service_variables_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_variable_options" ADD CONSTRAINT "service_variable_options_variable_id_fkey" FOREIGN KEY ("variable_id") REFERENCES "service_variables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
