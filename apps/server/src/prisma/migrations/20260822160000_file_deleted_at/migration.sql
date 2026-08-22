-- AlterTable
ALTER TABLE "File" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "File_deletedAt_idx" ON "File"("deletedAt");
