-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('INICIAL', 'NEGOCIOS', 'ESCALA_TOTAL');

-- AlterTable
ALTER TABLE "companies"
  ADD COLUMN "plan" "PlanTier" NOT NULL DEFAULT 'INICIAL',
  ADD COLUMN "stripe_customer_id" TEXT UNIQUE,
  ADD COLUMN "stripe_subscription_id" TEXT UNIQUE,
  ADD COLUMN "subscription_status" TEXT DEFAULT 'active';
