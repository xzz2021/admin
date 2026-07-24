import * as z from "zod"
import { createZodDto } from "nestjs-zod/dto"
import { CompleteRole, RelatedRoleModel, CompletePermission, RelatedPermissionModel } from "./index"

export const RolePermissionModel = z.object({
  roleId: z.string(),
  permissionId: z.string(),
})

export class RolePermissionDto extends createZodDto(RolePermissionModel) {
}

export interface CompleteRolePermission extends z.infer<typeof RolePermissionModel> {
  role: CompleteRole
  permission: CompletePermission
}

/**
 * RelatedRolePermissionModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedRolePermissionModel: z.ZodType<CompleteRolePermission> = z.lazy(() => RolePermissionModel.extend({
  role: RelatedRoleModel,
  permission: RelatedPermissionModel,
}))
