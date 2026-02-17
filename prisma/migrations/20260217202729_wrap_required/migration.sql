/*
  Warnings:

  - Made the column `wrapMessageID` on table `Wrap` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Wrap" ALTER COLUMN "wrapMessageID" SET NOT NULL;
