-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "district" TEXT;

-- CreateIndex
CREATE INDEX "Order_district_idx" ON "Order"("district");
