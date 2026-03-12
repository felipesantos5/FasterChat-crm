-- CreateEnum
CREATE TYPE "CustomerTemperature" AS ENUM ('HOT', 'WARM', 'COLD', 'UNKNOWN');

-- AlterTable
ALTER TABLE "customers"
  ADD COLUMN "temperature" "CustomerTemperature" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "temperature_updated_at" TIMESTAMP(3);
