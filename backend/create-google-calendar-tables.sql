-- Migration: Add Google Calendar and Appointments tables
-- Execute este arquivo para criar as tabelas necessárias

-- Criar enums se não existirem
DO $$ BEGIN
    CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "AppointmentType" AS ENUM ('VISIT', 'INSTALLATION', 'MAINTENANCE', 'CONSULTATION', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Criar tabela google_calendars
CREATE TABLE IF NOT EXISTS "google_calendars" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT NOT NULL,
    "token_expiry" TIMESTAMP(3) NOT NULL,
    "calendar_id" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendars_pkey" PRIMARY KEY ("id")
);

-- Criar tabela appointments
CREATE TABLE IF NOT EXISTS "appointments" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "AppointmentType" NOT NULL DEFAULT 'VISIT',
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "google_event_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- Criar índices únicos
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendars_company_id_key" ON "google_calendars"("company_id");

-- Criar índices de busca
CREATE INDEX IF NOT EXISTS "google_calendars_company_id_idx" ON "google_calendars"("company_id");
CREATE INDEX IF NOT EXISTS "appointments_company_id_idx" ON "appointments"("company_id");
CREATE INDEX IF NOT EXISTS "appointments_customer_id_idx" ON "appointments"("customer_id");
CREATE INDEX IF NOT EXISTS "appointments_start_time_idx" ON "appointments"("start_time");
CREATE INDEX IF NOT EXISTS "appointments_status_idx" ON "appointments"("status");
CREATE INDEX IF NOT EXISTS "appointments_type_idx" ON "appointments"("type");

-- Adicionar foreign keys
ALTER TABLE "google_calendars"
ADD CONSTRAINT "google_calendars_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "appointments"
ADD CONSTRAINT "appointments_customer_id_fkey"
FOREIGN KEY ("customer_id") REFERENCES "customers"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Mensagem de sucesso
SELECT 'Tabelas google_calendars e appointments criadas com sucesso!' AS resultado;
