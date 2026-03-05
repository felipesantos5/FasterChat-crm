-- Altera o default do campo plan para FREE (era INICIAL)
ALTER TABLE "companies" ALTER COLUMN "plan" SET DEFAULT 'FREE';
