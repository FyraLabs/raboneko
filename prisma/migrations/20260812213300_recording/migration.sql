-- CreateTable
CREATE TABLE "Recording" (
    "id" SERIAL NOT NULL,
    "storageID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recording_storageID_key" ON "Recording"("storageID");
