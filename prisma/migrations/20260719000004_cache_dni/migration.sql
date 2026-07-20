
-- CreateTable
CREATE TABLE "DniCache" (
    "dni" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DniCache_pkey" PRIMARY KEY ("dni")
);

-- CreateIndex
CREATE INDEX "DniCache_fetchedAt_idx" ON "DniCache"("fetchedAt");

