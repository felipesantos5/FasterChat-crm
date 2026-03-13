-- AlterEnum: Add FLOW to SenderType (if not exists)
DO $$ BEGIN
  ALTER TYPE "SenderType" ADD VALUE 'FLOW';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
