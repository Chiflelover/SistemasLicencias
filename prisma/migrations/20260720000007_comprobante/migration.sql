-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('BOLETA', 'FACTURA');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "receiptType" "ReceiptType";


