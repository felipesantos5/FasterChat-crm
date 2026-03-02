-- AlterTable: add is_fixed column to pipeline_stages
ALTER TABLE "pipeline_stages" ADD COLUMN "is_fixed" BOOLEAN NOT NULL DEFAULT FALSE;

-- Mark the first two stages (order 0 and 1) of every company as fixed
UPDATE "pipeline_stages"
SET "is_fixed" = TRUE
WHERE "order" IN (0, 1);
