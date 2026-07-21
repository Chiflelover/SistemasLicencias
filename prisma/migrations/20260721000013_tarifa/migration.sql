
-- CreateTable
CREATE TABLE "Tarifa" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "amount" DECIMAL(10,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tarifa_pkey" PRIMARY KEY ("id")
);

