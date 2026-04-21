-- AlterTable
ALTER TABLE "users" ADD COLUMN     "calendarDisplay" TEXT NOT NULL DEFAULT 'BOTH',
ADD COLUMN     "notificationQuietHoursEnd" INTEGER DEFAULT 7,
ADD COLUMN     "notificationQuietHoursStart" INTEGER DEFAULT 22,
ADD COLUMN     "numeralSystem" TEXT NOT NULL DEFAULT 'LATIN',
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'ar',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh';
