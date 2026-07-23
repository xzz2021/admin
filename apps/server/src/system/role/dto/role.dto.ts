import { MenuModel, PermissionModel, RoleModel } from '@prisma/generated/zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RoleMenuSchema = z.object({
  id: z.string().min(1),

  // 允许为空数组，因为更新时可能不勾选权限
  permissionIds: z
    .array(z.string().min(1))
    .optional()
    .default([])
    .transform(val => [...new Set(val)])
    .meta({ description: '权限ID', example: ['2', '3'] }),
});
const CreateRoleSchema = RoleModel.pick({
  name: true,
  code: true,
  enabled: true,
  description: true,
}).extend({
  menus: z.array(RoleMenuSchema).default([]),
});
export class CreateRoleDto extends createZodDto(CreateRoleSchema) {}

const QueryRoleParamsSchema = z.object({
  pageIndex: z.coerce.number().int().min(1).optional().default(1).meta({ description: '页码', example: 1 }),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10).meta({ description: '每页条数', example: 10 }),
  keyword: z.string().optional().meta({ description: '角色名称或编码（模糊匹配）' }),
  // query 中拿到的都是序列化后的字符串
  enabled: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform(val => (val === undefined ? undefined : val === true || val === 'true'))
    .meta({ description: '角色状态', example: true }),
});
export class QueryRoleParams extends createZodDto(QueryRoleParamsSchema) {}

const UpdateRoleSchema = CreateRoleSchema.and(
  z.object({
    id: z.string().min(1).meta({ description: '角色ID', example: '1' }),
  }),
);
export class UpdateRoleDto extends createZodDto(UpdateRoleSchema) {}

const DeleteRoleSchema = z.object({
  id: z.string().min(1).meta({ description: '角色ID', example: '1' }),
});
export class DeleteRoleDto extends createZodDto(DeleteRoleSchema) {}

const RoleSeedSchema = RoleModel.pick({
  name: true,
  code: true,
  enabled: true,
  description: true,
}).partial({
  enabled: true,
  description: true,
});
export class RoleSeedDto extends createZodDto(RoleSeedSchema) {}

const RoleSeedArraySchema = z.object({
  data: z.array(RoleSeedSchema),
});
export class RoleSeedArrayDto extends createZodDto(RoleSeedArraySchema) {}

const PermissionSchema = PermissionModel.pick({
  name: true,
  code: true,
});

const RoleMenuListSchema = MenuModel.pick({
  id: true,
  name: true,
  path: true,
  sort: true,
  parentId: true,
}).extend({
  permissions: z.array(PermissionSchema),
});

const RoleListSchema = RoleModel.pick({
  id: true,
  name: true,
  code: true,
  sort: true,
  description: true,
  isSystem: true,
  enabled: true,
}).extend({
  createdAt: z.string(),
});

const RoleListResSchema = z.object({
  total: z.number().meta({ description: '总条数', example: 10 }),
  list: z.array(RoleListSchema).meta({ description: '列表数据' }),
});
export class RoleListRes extends createZodDto(RoleListResSchema) {}

const MetaPermissionSchema = MenuModel.pick({
  title: true,
  icon: true,
  affix: true,
  activeMenu: true,
  alwaysShow: true,
  breadcrumb: true,
  canTo: true,
  hidden: true,
  noCache: true,
  noTagsView: true,
}).extend({
  permissions: z.array(z.string()).meta({ description: '权限code列表', example: ['add', 'edit', 'delete'] }),
});

const MenuPermissionListSchema = MenuModel.pick({
  id: true,
  name: true,
  path: true,
  component: true,
  redirect: true,
  type: true,
  sort: true,
  enabled: true,
  parentId: true,
}).extend({
  meta: MetaPermissionSchema,
});

const MenuPermissionListResSchema = z.object({
  list: z.array(MenuPermissionListSchema).meta({ description: '列表数据' }),
});
export class MenuPermissionListRes extends createZodDto(MenuPermissionListResSchema) {}
