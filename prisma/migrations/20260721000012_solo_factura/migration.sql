-- AlterEnum
BEGIN;
CREATE TYPE "ReceiptType_new" AS ENUM ('FACTURA');
ALTER TABLE "Payment" ALTER COLUMN "receiptType" TYPE "ReceiptType_new" USING ("receiptType"::text::"ReceiptType_new");
ALTER TYPE "ReceiptType" RENAME TO "ReceiptType_old";
ALTER TYPE "ReceiptType_new" RENAME TO "ReceiptType";
DROP TYPE "ReceiptType_old";
COMMIT;


