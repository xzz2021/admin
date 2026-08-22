# 数据流

## 登录与动态菜单

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant A as Admin
  participant S as Server
  participant R as Redis
  participant P as PG

  B->>A: 获取验证码 captcha/common
  S->>R: 存 captchaId
  B->>A: 提交登录 auth/rt/login
  A->>S: phone/password + captcha cookie
  S->>P: 校验用户 argon2
  S->>R: 写会话 / RT
  S-->>A: access_token + userinfo（RT 写 cookie）
  A->>S: role/getRoleMenu
  S->>P: 查角色菜单权限
  S-->>A: 菜单树 + permissions
  A->>A: generateRoutes + addRoute
```

## 鉴权业务请求

1. Axios 附加 `Authorization: Bearer <access_token>`
2. Nginx（生产）去掉 `/api` 前缀
3. Nest：限流 → JWT → PermissionGuard（可选 Redis 权限缓存）
4. Service 访问 Prisma / Redis
5. TransformInterceptor 将载荷包装为 `ResOp`；失败走 AllExceptionsFilter，禁止业务层 `return { code }`

## Token 刷新

- 业务响应 401/406 → 独立请求 `POST /auth/refresh`（`withCredentials`）
- 成功：更新 Pinia token 并重试原请求
- Refresh 仍 401：清空登录态跳转登录页

## 站内消息派发

```mermaid
flowchart LR
  API[MessageInbox/AdminController] --> Queue[BullMQ message-dispatch]
  Queue --> Worker[MessageProcessor]
  Worker --> PG[(Message 表)]
  Worker --> Redis
  Redis --> WS[MessageGateway]
  WS --> Client[浏览器]
```

## 在线用户 / 监控

- 登录后前端建立 `/online/ws`、`/monitor/ws`（经 `/api` 反代）
- 会话吊销由 `SessionModule` 发领域事件；`OnlineModule`（Presence）监听后清 Redis 并通知 Gateway
- 监控快照：`GET /monitor/snapshot`（权限 `server:view`）

## 文件上传

- `POST /staticfile/upload` 写入文件管理目录；头像走 `POST /user/upload/avatar`
- 静态文件由独立中间件按 `STATIC_FILE_ROOT_PATH` 前缀提供（磁盘目录示例：`public`，对外 URL 示例：`api/public`）
- 元数据可写入 `File` 模型

## 操作日志

- `OperationLogInterceptor` 记录请求到 `UserOperationLog`
- 查询/删除：`/log/getUserOperationLogList`、`/log/deleteUserOperationLog`
- Schema 另有 `AuditLog`，当前无对等 HTTP 模块暴露
