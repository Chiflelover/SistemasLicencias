
-- CreateTable
CREATE TABLE "RucAnexosCache" (
    "ruc" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RucAnexosCache_pkey" PRIMARY KEY ("ruc")
);

-- CreateIndex
CREATE INDEX "RucAnexosCache_fetchedAt_idx" ON "RucAnexosCache"("fetchedAt");

