/*
  Warnings:

  - A unique constraint covering the columns `[reminderMessageID]` on the table `Reminder` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "reminderMessageID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Reminder_reminderMessageID_key" ON "Reminder"("reminderMessageID");
