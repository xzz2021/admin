# 扩展指南

## 新增后端业务模块

1. 在 `apps/server/src/system/<name>/` 创建 Module / Controller / Service
2. 在 `app.system.ts` 的 `CORE_SYSTEM_MODULE` 中注册
3. 需要持久化时在 `schema.prisma` 增加 Model → `migrate` → `generate`
4. 接口加 `@RequiredPermission('resource:action')`（公开接口用 `@Public()`）
5. 在菜单管理或 Seed 中增加对应菜单与权限码
6. 补充前端 `api/` 与 `views/`，并在服务端菜单配置 `component` 路径

## 新增权限码

1. 菜单管理中为菜单添加 Permission（或改 Seed `sql.ts`）
2. Controller 使用相同 `code` 字符串
3. 给角色分配后生效；注意 RBAC Redis 缓存 TTL，必要时失效缓存

## 新增前端页面

1. 在 `apps/admin/src/views/...` 添加 Vue 组件
2. 服务端菜单 `component` 填相对 views 的路径（由 `import.meta.glob` 映射）
3. 目录用 `#` / 父级 `##` 约定（见 `routerHelper`）
4. 按钮权限：在路由 meta 写入权限列表，模板使用 `v-hasPermi`

## 新增异步任务

参考 `MessageModule`：`@nestjs/bullmq` 注册队列 + Processor；注意幂等（如 Message 的 `dispatchId`）。

## 新增 WebSocket

参考 `online` / `monitor` / `message` Gateway：路径挂在 Nest 根；Gateway 内自校验 JWT；Nginx 需 Upgrade。

## 不建议

- 编造未实现的 Notice/AuditLog API 而不补模块
- 在 Nest 再设一层与网关重复的全局 `api` 前缀（当前刻意注释，靠反代剥离）
- 跳过权限装饰器直接依赖「前端隐藏按钮」
