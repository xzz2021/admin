# Role 模块

路径：`apps/server/src/system/role/`

## HTTP API

| 方法   | 路径                          | 权限                                                  |
| ------ | ----------------------------- | ----------------------------------------------------- |
| GET    | `/role/getRoleList`           | `role:view`                                           |
| POST   | `/role/add`                   | `role:add`                                            |
| POST   | `/role/update`                | `role:update`                                         |
| DELETE | `/role/:id`                   | `role:delete`                                         |
| GET    | `/role/getRoleDetail/:id`     | `role:view`                                           |
| GET    | `/role/getRoleMenuAndPer/:id` | `role:view`                                           |
| GET    | `/role/getRoleMenu`           | 当前用户菜单+权限（无 `@RequiredPermission`，需登录） |
| POST   | `/role/generateRoleSeed`      | `role:seed`                                           |

## 行为要点

- 角色绑定菜单（RoleMenu）与权限（RolePermission）
- `getRoleMenu` 供前端登录后生成动态路由
- `generateRoleSeed` 用于导出种子数据，不等于 `prisma db seed`
- 系统角色（`isSystem`）不可删除；超管约定 code：`super_admin`

## 前端

- 列表：`views/Authorization/Role/Role.vue`
- 分配：`AssignMenuPermission.vue`（隐藏路由 `/role/assign/:id?`）
- 详情：`RoleDetail.vue`
- API：`api/role/`
- Store：`store/modules/role.ts`
