-- Adds Licence.lastReminderAt so the per-licence reminder cron can throttle
-- itself without overloading the user-driven `lastCheckedAt` field.
-- 2026-05-22 process correction follow-up.

ALTER TABLE "licences" ADD COLUMN "lastReminderAt" TIMESTAMP(3);
