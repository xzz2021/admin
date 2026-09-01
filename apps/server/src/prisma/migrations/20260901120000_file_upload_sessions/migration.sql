-- AlterTable
ALTER TABLE "File" ALTER COLUMN "mimeType" SET DATA TYPE VARCHAR(255);
ALTER TABLE "File" ADD COLUMN "sha256" CHAR(64);

CREATE INDEX "File_sha256_idx" ON "File"("sha256");

CREATE UNIQUE INDEX "File_sha256_active_key"
ON "File" ("sha256")
WHERE "deletedAt" IS NULL AND "sha256" IS NOT NULL;

-- CreateEnum
CREATE TYPE "FileUploadStatus" AS ENUM ('INITIATED', 'UPLOADING', 'COMPLETING', 'COMPLETED', 'ABORTED', 'EXPIRED', 'FAILED');

-- CreateTable
CREATE TABLE "FileUploadSession" (
    "id" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "size" BIGINT NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(255) NOT NULL,
    "chunkSize" INTEGER NOT NULL,
    "totalChunks" INTEGER NOT NULL,
    "status" "FileUploadStatus" NOT NULL DEFAULT 'INITIATED',
    "createdById" TEXT NOT NULL,
    "tempDir" VARCHAR(255) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FileUploadChunk" (
    "id" SERIAL NOT NULL,
    "sessionId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "FileUploadChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FileUploadSession_createdById_idx" ON "FileUploadSession"("createdById");
CREATE INDEX "FileUploadSession_sha256_idx" ON "FileUploadSession"("sha256");
CREATE INDEX "FileUploadSession_status_expiresAt_idx" ON "FileUploadSession"("status", "expiresAt");
CREATE UNIQUE INDEX "FileUploadChunk_sessionId_chunkIndex_key" ON "FileUploadChunk"("sessionId", "chunkIndex");
CREATE INDEX "FileUploadChunk_sessionId_idx" ON "FileUploadChunk"("sessionId");

ALTER TABLE "FileUploadSession" ADD CONSTRAINT "FileUploadSession_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FileUploadChunk" ADD CONSTRAINT "FileUploadChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FileUploadSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
