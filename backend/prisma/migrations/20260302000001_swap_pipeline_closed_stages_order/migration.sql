-- Swap order of "Fechado - Ganho" (4→5) and "Fechado - Perdido" (5→4)
-- so that "Fechado - Ganho" appears last in the pipeline.
-- Uses a temp value (99) to avoid unique constraint conflicts during the swap.

UPDATE "pipeline_stages" SET "order" = 99  WHERE "name" = 'Fechado - Ganho'  AND "order" = 4;
UPDATE "pipeline_stages" SET "order" = 4   WHERE "name" = 'Fechado - Perdido' AND "order" = 5;
UPDATE "pipeline_stages" SET "order" = 5   WHERE "name" = 'Fechado - Ganho'  AND "order" = 99;
