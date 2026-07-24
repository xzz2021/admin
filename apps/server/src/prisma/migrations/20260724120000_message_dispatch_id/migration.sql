-- AlterTable
ALTER TABLE "Message" ADD COLUMN "dispatchId" TEXT;

-- Backfill existing rows (one synthetic batch id per message)
UPDATE "Message" SET "dispatchId" = "id" WHERE "dispatchId" IS NULL;

-- Make required
ALTER TABLE "Message" ALTER COLUMN "dispatchId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Message_dispatchId_receiverId_key" ON "Message"("dispatchId", "receiverId");
