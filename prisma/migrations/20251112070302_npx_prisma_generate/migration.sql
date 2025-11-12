-- CreateEnum
CREATE TYPE "MasterDataCategory" AS ENUM ('campaign', 'creative', 'channel', 'budgetAccount', 'department', 'agency');

-- CreateTable
CREATE TABLE "MasterDataItem" (
    "id" TEXT NOT NULL,
    "category" "MasterDataCategory" NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterDataItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterDataItem_category_idx" ON "MasterDataItem"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MasterDataItem_category_value_key" ON "MasterDataItem"("category", "value");
