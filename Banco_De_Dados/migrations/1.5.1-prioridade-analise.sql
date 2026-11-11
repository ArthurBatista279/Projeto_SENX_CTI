BEGIN;
ALTER TABLE public."Analise"
    ADD COLUMN IF NOT EXISTS "Prioridade" smallint CHECK ("Prioridade" BETWEEN 0 AND 2),
    ADD COLUMN IF NOT EXISTS "MotivoPrioridade" varchar(255);
-- NULL preserves legacy analyses: confirmed cancellation maps to high priority on read.
COMMIT;
