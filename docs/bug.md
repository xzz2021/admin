## 三、冗余（违反 DRY / 复用优先）

### 前端

| 项              | 说明                                                                                                |
| --------------- | --------------------------------------------------------------------------------------------------- |
| CRUD 页面复制   | User / Role / File / Log / Department / Dictionary 各自写 ids、删除确认、loading、刷新              |
| 上传 UI 重复    | `UploadBtn` 与 `S3UploadBtn` 重复触发、loading、通知；S3 还硬编码 `bucket: 'public'`、`alert`、中文 |
| 预览两套分发    | `RenderFile.vue` 与 OSS `previewFile` 行为不一致                                                    |
| Viewer 工厂重复 | Image / Txt / Audio / Video 各自 createVNode + append body；Image/Txt 销毁不完整                    |
| 前后端 DTO 双写 | user/menu/role/dbBackup 等类型已漂移（`permissions` vs `permissionList`、`enabled` vs `status`）    |

### 仓库级

| 项                   | 说明                                                   |
| -------------------- | ------------------------------------------------------ |
| 伪 monorepo          | `packages/utils/test.ts` 是空文件，没有可消费包        |
| 文档宣称共享包存在   | `docs/README.md` 写 `packages/` 含 config/types/utils  |
| ESLint/Prettier 双份 | admin 与 server 行宽、逗号、箭头括号策略不同           |
| 部署文档互相复制     | docker / environment / production 环境与网络说明已矛盾 |

---

## 四、实现不够优雅 / 低效

7. PermissionGuard：直接 pgService.user.findUnique 拉权限树；应走 User/RBAC 仓储或已有权限缓存。
8. DbBackup：任务/配置 Prisma 仍散落在 Service + Config + Lifecycle；复杂写入可收成一个 DbBackupRepository，不必再拆类。

9. 启用注释掉的登录锁定（lockout.service.ts），作为 Identity 领域策略，而不是只靠验证码+全局限流。
10. Prisma 关系缺口（Role.createdBy 裸字符串、Menu.type 裸 Int 等）会卡住真正的聚合根。

### 5. TypeScript 名不副实

```18:23:apps/admin/tsconfig.json
"strictFunctionTypes": false,
...
"noImplicitAny": false,
```

server 同样 `noImplicitAny: false`，且未开完整 `strict`。`typecheck` 通过不能说明类型安全。

**推荐:** 分阶段打开 `noImplicitAny`、`strictFunctionTypes`、`no-explicit-any`；全局 `Fn`/`Recordable`/`IResponse` 默认改成 `unknown`。

### 6. 巨型函数 / 巨型组件

- `Menu/Write.vue` ~850 行：表单、权限 CRUD、导入导出、剪贴板、DTO 兼容
- `AssignMenuPermissionPanel.vue` ~650 行
- `Form` 类型定义、`Table.vue` 也都偏大

---

## 五、设计不够合理

### 5. Prisma 模型缺口

- `Role.createdBy`、`UserRole.assignedBy` 是裸字符串，没有 User 关系
- `Menu.type` 用裸 `Int`，注释掉的 `MenuType` enum 未启用
- `Department @@unique([parentId, name])` 无法约束多个 `parentId = NULL` 的同名根部门
- `File.path` 未 unique；`File.size` 用 `Int`，超约 2GB 会溢出
- `AuditLog` 与 `UserOperationLog` 职责重叠；`Notice` / `AuditLog` 建了表但业务模块不完整
- 用户列表按随机 CUID `id desc` 排序，应改 `createdAt desc` 并加索引

### 6. 登录防爆破实际没开

`lockout.service.ts` 整文件注释。验证码 + 全局限流代替不了账号级失败锁定。

### 7. 前端 HTTP 层隐式依赖 Pinia

`axios/auth.ts` 直接读 user store；`user` 与 `tagsView` 互相引用。测试和边界都变差。应做成 `AuthTokenProvider`。

### 8. 契约没有单一来源

后端 Zod/Prisma DTO 与前端手写 types 已漂移（菜单 `keepAlive`、角色 `sort`/`updatedAt`、`permissionList` vs `permissions`）。`Menu/Write.vue` 里已经在做大量适配。

**推荐:** OpenAPI 或共享 `packages/contracts` 生成客户端；admin 不要直接依赖 Prisma Client。注意 server Dockerfile 目前没复制 `packages/`，加共享包后镜像会装失败。

### 9. 测试与 CI 覆盖不足

- admin **零测试**
- 所谓 e2e 仍 mock 了 Prisma/Redis/认证，验不了真实过滤器、迁移、会话
- CI 无 `prisma validate`、无生成代码 drift check、无 Docker/Nginx 校验
- Jest 覆盖范围会扫到 `generated/`

### 10. Docker / Nginx 信任边界

- Nginx 无条件信任客户端 `X-Real-IP` / `X-Forwarded-Proto`
- CSP 含 `'unsafe-inline'` / `'unsafe-eval'`

---
