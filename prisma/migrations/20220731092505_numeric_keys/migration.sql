/*
  Warnings:

  - The primary key for the `ProgressLog` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to alter the column `id` on the `ProgressLog` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProgressLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userID" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" INTEGER NOT NULL,
    "product" INTEGER NOT NULL,
    "summary" TEXT NOT NULL
);
INSERT INTO "new_ProgressLog" ("createdAt", "product", "summary", "type", "userID") SELECT "createdAt", "product", "summary", "type", "userID" FROM "ProgressLog";
DROP TABLE "ProgressLog";
ALTER TABLE "new_ProgressLog" RENAME TO "ProgressLog";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
