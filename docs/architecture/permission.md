# RBAC 权限设计

## 模型

```
User ──< UserRole >── Role ──< RoleMenu >── Menu
                       │
                       └──< RolePermission >── Permission ──> Menu
```

- **菜单**：驱动前端路由与侧栏（字段含 path、component、meta 类属性）
- **权限**：挂在菜单下，`code` 全局唯一（如 `user:view`），类型含 BUTTON / DATA / API / OTHER
- **角色**：绑定菜单集合 + 权限集合；`isSystem` 系统角色不可删
- **超管**：角色 `code === 'super_admin'` 在后端 Guard 中视为拥有 `*`

Seed 中权限编码规则：`code = \`${resource}:${action}\``，`resource`对应该菜单`path`。

## 后端校验

关键代码：

- 装饰器：`apps/server/src/processor/decorator/permission.ts` → `@RequiredPermission(code)`
- Guard：`apps/server/src/processor/guard/permission.ts`（全局 APP_GUARD）
- 缓存：`RbacPermissionCacheService`（TTL 约 5 分钟 + 抖动；未命中 singleflight；失效靠 per-user 版本号）
- 未命中：`UserRepository.findEnabledRolePermissionTree`，再 `resolvePermissionCodes`

流程：

1. 无 `@RequiredPermission` → 放行（仍需通过 JWT，除非 `@Public`）
2. 有则取 `request.user.id`
3. `PermissionGuard` 先读 Redis 权限缓存；未命中再走 User 仓储；空权限列表会负缓存
4. 含 `*` 或精确匹配所需 code → 通过
5. 角色/权限变更由仓储查出 userId，缓存只 INCR 版本并删 Redis；DEL 失败时旧条目因版本不匹配也会失效

注释中提及 CASL 细粒度字段权限为后续设想；`PoliciesGuard` 当前未注册。

## 前端校验

| 层       | 机制                                                         |
| -------- | ------------------------------------------------------------ |
| 路由     | 仅加载角色菜单对应的动态路由                                 |
| 按钮     | `v-hasPermi` / `<Permission>` 对照当前路由 meta 中的权限列表 |
| 菜单维护 | `views/Authorization/Menu` + `permission/*` API              |

服务端接口 `GET /role/getRoleMenu` 返回当前用户菜单与权限，供登录后初始化。

## 权限码与接口对照（摘录）

| 权限码示例                                                             | 使用位置                                    |
| ---------------------------------------------------------------------- | ------------------------------------------- |
| `user:view` / `user:add` / `user:update` / `user:delete`               | UserController                              |
| `role:view` / `role:add` / `role:update` / `role:delete` / `role:seed` | RoleController                              |
| `menu:view` / `menu:add` / `menu:update` / `menu:delete`               | MenuController；Permission CRUD 复用 menu:* |
| `department:*` / `dictionary:*`                                        | 对应模块                                    |
| `fileList:view` / `add` / `delete`                                     | StaticfileController                        |
| `onlineUser:view` / `kick`                                             | OnlineController                            |
| `server:view`                                                          | MonitorController                           |
| `message:view` / `send`                                                | MessageController                           |
| `userLog:view` / `delete`                                              | LoggerController（访问日志）                |
| `auditLog:view`                                                        | LoggerController（操作日志，无删除）        |

## 与会话的关系

- Access Token：Bearer，全局 JWT Guard 校验
- Refresh Token：httpOnly cookie `rt`（双 token 登录路径）
- 强制下线 / kick：撤销会话 + WS 通知
- SSO：`SSO_COUNT` 限制同用户最大会话数

详见 [authentication.md](../api/authentication.md)。
