/*
  Warnings:

  - A unique constraint covering the columns `[logMessageID]` on the table `ProgressLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ProgressLog" ADD COLUMN     "logMessageID" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProgressLog_logMessageID_key" ON "ProgressLog"("logMessageID");
