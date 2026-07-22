
-- CreateTable
CREATE TABLE "Uit" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "amount" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Uit_pkey" PRIMARY KEY ("id")
);

