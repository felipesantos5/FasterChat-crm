-- AlterTable
ALTER TABLE "flows" ADD COLUMN "send_window_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "flows" ADD COLUMN "send_window_start" INTEGER NOT NULL DEFAULT 8;
ALTER TABLE "flows" ADD COLUMN "send_window_end" INTEGER NOT NULL DEFAULT 21;
