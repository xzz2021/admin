## 三、冗余（违反 DRY / 复用优先）

### 前端

| 项               | 说明                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------- |
| Store 薄包装 API | OSS / System / Role / Department 的 Pinia 几乎只转发 HTTP，页面又直接调 API                         |
| CRUD 页面复制    | User / Role / File / Log / Department / Dictionary 各自写 ids、删除确认、loading、刷新              |
| 上传 UI 重复     | `UploadBtn` 与 `S3UploadBtn` 重复触发、loading、通知；S3 还硬编码 `bucket: 'public'`、`alert`、中文 |
| 预览两套分发     | `RenderFile.vue` 与 OSS `previewFile` 行为不一致                                                    |
| Viewer 工厂重复  | Image / Txt / Audio / Video 各自 createVNode + append body；Image/Txt 销毁不完整                    |
| 前后端 DTO 双写  | user/menu/role/dbBackup 等类型已漂移（`permissions` vs `permissionList`、`enabled` vs `status`）    |

### 仓库级

| 项                   | 说明                                                   |
| -------------------- | ------------------------------------------------------ |
| 伪 monorepo          | `packages/utils/test.ts` 是空文件，没有可消费包        |
| 文档宣称共享包存在   | `docs/README.md` 写 `packages/` 含 config/types/utils  |
| ESLint/Prettier 双份 | admin 与 server 行宽、逗号、箭头括号策略不同           |
| 部署文档互相复制     | docker / environment / production 环境与网络说明已矛盾 |

---

## 四、实现不够优雅 / 低效

### 3. RBAC 缓存无防击穿

缓存未命中时每个并发请求都会查完整权限树；Redis 删失败会留下最长约 5 分钟旧权限。

**推荐:** singleflight / 短锁、TTL 抖动、负缓存；高安全场景加权限版本号或 outbox。

### 5. TypeScript 名不副实

```18:23:apps/admin/tsconfig.json
"strictFunctionTypes": false,
...
"noImplicitAny": false,
```

server 同样 `noImplicitAny: false`，且未开完整 `strict`。`typecheck` 通过不能说明类型安全。

**推荐:** 分阶段打开 `noImplicitAny`、`strictFunctionTypes`、`no-explicit-any`；全局 `Fn`/`Recordable`/`IResponse` 默认改成 `unknown`。

### 6. 巨型函数 / 巨型组件

- `db-backup.service.ts`：配置、调度、锁、文件生命周期、pg_dump、告警全揉在一起（500+ 行）
- `Menu/Write.vue` ~850 行：表单、权限 CRUD、导入导出、剪贴板、DTO 兼容
- `AssignMenuPermissionPanel.vue` ~650 行
- `Form` 类型定义、`Table.vue` 也都偏大

---

## 五、设计不够合理

### 1. 没有真正的数据访问层

规则写了 Repository，实际是 `Controller → Service → PgService(PrismaClient)`。User / Role / Auth / Backup 已经同时承担查询、缓存、文件、WebSocket。简单 CRUD 还能撑，复杂模块会继续膨胀。

不必上完整 DDD。至少把 **会话、在线状态、备份执行器** 抽成独立模块，Service 不要直接碰 Gateway / Express `Response`。

### 2. Auth ↔ Online 循环依赖

`AuthModule`、`OnlineModule`、`UserService`、`MessageModule` 用 `forwardRef` + `@Optional()`。初始化错误会被藏起来。

**推荐:** 独立 `SessionModule` / `PresenceModule`，用领域事件做强制下线。

### 3. HTTP 适配泄漏进业务

`AuthService.rtLogin/rtRefresh/logout` 接收 Express `Response`，`RtTokenService` 直接 `res.cookie()`。

**推荐:** Service 返回 token/cookie 描述，Controller 或 Cookie Adapter 写响应。

### 4. 用 URL 前缀绕过鉴权

多个 JWT Guard 对 `/public/` 直接放行。未来同前缀业务接口可能意外公开。

**推荐:** 只认 `@Public()`；静态资源由独立中间件处理。

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
