-- CreateEnum
CREATE TYPE "MenuType" AS ENUM ('DIRECTORY', 'MENU');

-- AlterTable Menu.type Int -> MenuType
ALTER TABLE "Menu" ADD COLUMN "type_new" "MenuType";

UPDATE "Menu" SET "type_new" = CASE
  WHEN "type" = 1 THEN 'MENU'::"MenuType"
  ELSE 'DIRECTORY'::"MenuType"
END;

ALTER TABLE "Menu" DROP COLUMN "type";
ALTER TABLE "Menu" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "Menu" ALTER COLUMN "type" SET NOT NULL;
ALTER TABLE "Menu" ALTER COLUMN "type" SET DEFAULT 'DIRECTORY'::"MenuType";

-- Role.createdBy -> createdById + User FK
ALTER TABLE "Role" RENAME COLUMN "createdBy" TO "createdById";

UPDATE "Role"
SET "createdById" = NULL
WHERE "createdById" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "Role"."createdById");

CREATE INDEX "Role_createdById_idx" ON "Role"("createdById");

ALTER TABLE "Role" ADD CONSTRAINT "Role_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- UserRole.assignedBy -> assignedById + User FK
ALTER TABLE "UserRole" RENAME COLUMN "assignedBy" TO "assignedById";

UPDATE "UserRole"
SET "assignedById" = NULL
WHERE "assignedById" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = "UserRole"."assignedById");

CREATE INDEX "UserRole_assignedById_idx" ON "UserRole"("assignedById");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
