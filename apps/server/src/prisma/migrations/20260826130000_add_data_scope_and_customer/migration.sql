-- CreateEnum
CREATE TYPE "DataScope" AS ENUM ('ALL', 'SELF', 'DEPT', 'DEPT_TREE', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('LEAD', 'FOLLOWING', 'WON', 'FROZEN');

-- Extend Permission with explicit resource/action metadata.
-- Existing permissions intentionally remain unscoped; values are not inferred from code.
ALTER TABLE "Permission"
    ADD COLUMN "resource" VARCHAR(100),
    ADD COLUMN "action" VARCHAR(50),
    ADD COLUMN "scopeEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Permission_resource_action_idx" ON "Permission"("resource", "action");

-- Upgrade RolePermission without deleting existing assignments.
-- Add nullable columns first so existing rows remain valid during backfill.
ALTER TABLE "RolePermission"
    ADD COLUMN "id" TEXT,
    ADD COLUMN "dataScope" "DataScope",
    ADD COLUMN "createdAt" TIMESTAMP(3),
    ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Assign stable, unique IDs in the deterministic order of the former composite key.
-- This uses only built-in PostgreSQL functions and does not require pgcrypto.
WITH ranked AS (
    SELECT
        "roleId",
        "permissionId",
        row_number() OVER (ORDER BY "roleId", "permissionId") AS ordinal
    FROM "RolePermission"
)
UPDATE "RolePermission" AS rp
SET "id" = 'legacy_rp_' || lpad(ranked.ordinal::text, 20, '0')
FROM ranked
WHERE rp."roleId" = ranked."roleId"
  AND rp."permissionId" = ranked."permissionId";

-- Safely backfill timestamps before enforcing defaults and NOT NULL constraints.
UPDATE "RolePermission"
SET
    "createdAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "createdAt" IS NULL OR "updatedAt" IS NULL;

ALTER TABLE "RolePermission"
    ALTER COLUMN "id" SET NOT NULL,
    ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "createdAt" SET NOT NULL,
    ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP,
    ALTER COLUMN "updatedAt" SET NOT NULL;

ALTER TABLE "RolePermission" DROP CONSTRAINT "RolePermission_pkey";
ALTER TABLE "RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key"
    ON "RolePermission"("roleId", "permissionId");

-- CreateTable
CREATE TABLE "RolePermissionDepartment" (
    "id" TEXT NOT NULL,
    "rolePermissionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermissionDepartment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RolePermissionDepartment_rolePermissionId_departmentId_key"
    ON "RolePermissionDepartment"("rolePermissionId", "departmentId");
CREATE INDEX "RolePermissionDepartment_rolePermissionId_idx"
    ON "RolePermissionDepartment"("rolePermissionId");
CREATE INDEX "RolePermissionDepartment_departmentId_idx"
    ON "RolePermissionDepartment"("departmentId");

ALTER TABLE "RolePermissionDepartment"
    ADD CONSTRAINT "RolePermissionDepartment_rolePermissionId_fkey"
    FOREIGN KEY ("rolePermissionId") REFERENCES "RolePermission"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RolePermissionDepartment"
    ADD CONSTRAINT "RolePermissionDepartment_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Before strengthening root-department uniqueness, fail with a clear diagnostic
-- instead of letting CREATE INDEX report an opaque duplicate-key error.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Department"
        WHERE "parentId" IS NULL
        GROUP BY "name"
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION
            'Cannot enforce root department name uniqueness: duplicate names exist where parentId is NULL';
    END IF;
END
$$;

DROP INDEX "Department_parentId_name_key";
CREATE UNIQUE INDEX "Department_parentId_name_key"
    ON "Department"("parentId", "name") NULLS NOT DISTINCT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(30),
    "remark" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'LEAD',
    "dealAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "internalCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "confidential" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");
CREATE INDEX "Customer_departmentId_idx" ON "Customer"("departmentId");
CREATE INDEX "Customer_status_idx" ON "Customer"("status");
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt" DESC);
CREATE INDEX "Customer_departmentId_status_createdAt_idx"
    ON "Customer"("departmentId", "status", "createdAt" DESC);
CREATE INDEX "Customer_createdById_idx" ON "Customer"("createdById");

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
