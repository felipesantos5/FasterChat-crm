-- CreateEnum (if not exists)
DO $$ BEGIN
  CREATE TYPE "CustomerTemperature" AS ENUM ('HOT', 'WARM', 'COLD', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "customers"
  ADD COLUMN IF NOT EXISTS "temperature" "CustomerTemperature" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "temperature_updated_at" TIMESTAMP(3);
