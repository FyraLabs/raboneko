-- CreateTable
CREATE TABLE "Wrap" (
    "id" SERIAL NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "content" TEXT NOT NULL,
    "wrapMessageID" TEXT,

    CONSTRAINT "Wrap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wrap_wrapMessageID_key" ON "Wrap"("wrapMessageID");
