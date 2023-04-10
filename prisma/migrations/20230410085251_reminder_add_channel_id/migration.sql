/*
  Warnings:

  - Added the required column `channelID` to the `Reminder` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Reminder" ADD COLUMN     "channelID" TEXT NOT NULL;
