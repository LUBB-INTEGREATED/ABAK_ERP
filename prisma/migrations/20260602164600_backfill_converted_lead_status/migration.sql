-- Data backfill (E1): the conversion report and the convert-to-client flow now
-- use the dedicated CONVERTED lead status instead of overloading QUALIFIED.
-- Historically, conversion was recorded as QUALIFIED with a linked client, so
-- re-home those rows to CONVERTED to keep the conversion metric meaningful for
-- existing data. Runs in its own migration because Postgres forbids using a
-- freshly-added enum value in the same transaction that adds it.
UPDATE "leads"
SET "status" = 'CONVERTED'
WHERE "status" = 'QUALIFIED'
  AND "clientId" IS NOT NULL
  AND "deletedAt" IS NULL;
