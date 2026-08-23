-- AuditLog 改为领域审计：去掉 HTTP method/path，补资源 ID 与成败。
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "method";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "path";

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "resourceId" VARCHAR(64);
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "success" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE VARCHAR(80);
ALTER TABLE "AuditLog" ALTER COLUMN "resource" TYPE VARCHAR(100);
ALTER TABLE "AuditLog" ALTER COLUMN "ip" TYPE VARCHAR(45);

CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_resourceId_createdAt_idx" ON "AuditLog"("resourceId", "createdAt");
