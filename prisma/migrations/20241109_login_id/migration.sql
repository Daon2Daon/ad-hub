-- AlterTable
ALTER TABLE "User" ADD COLUMN "loginId" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- Backfill loginId using existing email prefix or fallback to id-based slug
UPDATE "User"
SET "loginId" = COALESCE(
  NULLIF(split_part("email", '@', 1), ''),
  'user_' || substr("id", 1, 8)
)
WHERE "loginId" IS NULL;

-- Ensure loginId is not null going forward
ALTER TABLE "User"
ALTER COLUMN "loginId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_loginId_key" ON "User"("loginId");

