-- Add quoted message fields to messages table for WhatsApp reply/quote display
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "quoted_content" TEXT;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "quoted_author" TEXT;
