-- 同级部门名称唯一：PostgreSQL 默认把 NULL 当成互不相同，根部门 parentId=NULL 时无法拦住同名。
-- 先消掉已有同名根部门，再按原约束名重建为 NULLS NOT DISTINCT，避免 Prisma @@unique 漂移。
UPDATE "Department" AS d
SET name = left(d.name, 40) || '-' || substring(d.id, 1, 8)
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt", id) AS rn
  FROM "Department"
  WHERE "parentId" IS NULL
) AS dups
WHERE d.id = dups.id AND dups.rn > 1;

DROP INDEX IF EXISTS "Department_parentId_name_key";
CREATE UNIQUE INDEX "Department_parentId_name_key" ON "Department"("parentId", "name") NULLS NOT DISTINCT;

-- 软删记录仍占路径，直到异步清理删行；重复 path 先改名再加唯一。
UPDATE "File" AS f
SET path = left(f.path, 230) || '#dup-' || f.id::text
WHERE f.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY path
      ORDER BY ("deletedAt" IS NULL) DESC, id
    ) AS rn
    FROM "File"
  ) AS ranked
  WHERE ranked.rn > 1
);

ALTER TABLE "File" ALTER COLUMN "size" SET DATA TYPE BIGINT;
CREATE UNIQUE INDEX "File_path_key" ON "File"("path");

CREATE INDEX "User_createdAt_idx" ON "User"("createdAt" DESC);
