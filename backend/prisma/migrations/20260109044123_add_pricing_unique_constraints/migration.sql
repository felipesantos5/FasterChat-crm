-- CreateEnum
CREATE TYPE "ZonePricingType" AS ENUM ('FIXED', 'PERCENTAGE', 'CUSTOM');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "address" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "zone_id" TEXT;

-- CreateTable
CREATE TABLE "service_pricing_tiers" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "min_quantity" INTEGER NOT NULL,
    "max_quantity" INTEGER,
    "price_per_unit" DECIMAL(10,2) NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_zones" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "pricing_type" "ZonePricingType" NOT NULL DEFAULT 'FIXED',
    "price_modifier" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "neighborhoods" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "requires_quote" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_combos" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fixed_price" DECIMAL(10,2) NOT NULL,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_combo_items" (
    "id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_additionals" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "applies_to_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_additionals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_zone_exceptions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "service_id" TEXT,
    "category" TEXT,
    "min_quantity" INTEGER,
    "exception_type" TEXT NOT NULL,
    "custom_fee" DECIMAL(10,2),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_zone_exceptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_pricing_tiers_service_id_idx" ON "service_pricing_tiers"("service_id");

-- CreateIndex
CREATE INDEX "service_zones_company_id_idx" ON "service_zones"("company_id");

-- CreateIndex
CREATE INDEX "service_zones_is_default_idx" ON "service_zones"("is_default");

-- CreateIndex
CREATE INDEX "service_zones_is_active_idx" ON "service_zones"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_zones_company_id_name_key" ON "service_zones"("company_id", "name");

-- CreateIndex
CREATE INDEX "service_combos_company_id_idx" ON "service_combos"("company_id");

-- CreateIndex
CREATE INDEX "service_combos_is_active_idx" ON "service_combos"("is_active");

-- CreateIndex
CREATE INDEX "service_combos_category_idx" ON "service_combos"("category");

-- CreateIndex
CREATE UNIQUE INDEX "service_combos_company_id_name_key" ON "service_combos"("company_id", "name");

-- CreateIndex
CREATE INDEX "service_combo_items_combo_id_idx" ON "service_combo_items"("combo_id");

-- CreateIndex
CREATE INDEX "service_combo_items_service_id_idx" ON "service_combo_items"("service_id");

-- CreateIndex
CREATE INDEX "service_additionals_company_id_idx" ON "service_additionals"("company_id");

-- CreateIndex
CREATE INDEX "service_additionals_is_active_idx" ON "service_additionals"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "service_additionals_company_id_name_key" ON "service_additionals"("company_id", "name");

-- CreateIndex
CREATE INDEX "service_zone_exceptions_company_id_idx" ON "service_zone_exceptions"("company_id");

-- CreateIndex
CREATE INDEX "service_zone_exceptions_zone_id_idx" ON "service_zone_exceptions"("zone_id");

-- CreateIndex
CREATE INDEX "service_zone_exceptions_service_id_idx" ON "service_zone_exceptions"("service_id");

-- CreateIndex
CREATE INDEX "service_zone_exceptions_category_idx" ON "service_zone_exceptions"("category");

-- CreateIndex
CREATE INDEX "customers_zone_id_idx" ON "customers"("zone_id");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "service_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_pricing_tiers" ADD CONSTRAINT "service_pricing_tiers_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combos" ADD CONSTRAINT "service_combos_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combo_items" ADD CONSTRAINT "service_combo_items_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "service_combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_combo_items" ADD CONSTRAINT "service_combo_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_additionals" ADD CONSTRAINT "service_additionals_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_zone_exceptions" ADD CONSTRAINT "service_zone_exceptions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
