-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuickMessageType" AS ENUM ('TEXT', 'MEDIA', 'AUDIO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "quick_messages" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "QuickMessageType" NOT NULL,
    "content" TEXT NOT NULL,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quick_messages_company_id_idx" ON "quick_messages"("company_id");

-- AddForeignKey
ALTER TABLE "quick_messages" ADD CONSTRAINT "quick_messages_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
