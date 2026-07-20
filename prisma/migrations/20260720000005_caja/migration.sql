-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'PENDING_APPROVAL', 'CLOSED');


-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "cashierId" TEXT NOT NULL,
    "openingAmount" DECIMAL(10,2) NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "cashCollected" DECIMAL(10,2),
    "digitalCollected" DECIMAL(10,2),
    "expectedAmount" DECIMAL(10,2),
    "countedAmount" DECIMAL(10,2),
    "difference" DECIMAL(10,2),
    "justification" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_cashierId_idx" ON "CashSession"("cashierId");

-- CreateIndex
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_cashierId_fkey" FOREIGN KEY ("cashierId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

