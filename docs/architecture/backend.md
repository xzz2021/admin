# 后端架构

路径：`apps/server`

## 入口与模块装配

| 文件                       | 作用                                                                             |
| -------------------------- | -------------------------------------------------------------------------------- |
| `src/main.ts`              | 启动、WsAdapter、trust proxy=2、Helmet、cookie-parser、Zod 管道、Swagger（可关） |
| `src/app.module.ts`        | 导入 `CORE_MODULE` + `CORE_SYSTEM_MODULE`，注册全局 Guard                        |
| `src/core/app.core.ts`     | 基础设施模块聚合                                                                 |
| `src/system/app.system.ts` | 业务模块聚合                                                                     |

全局 HTTP 前缀 `api` 在 `main.ts` 中**已注释**，Nest 路由为根路径（如 `/auth/login`）。生产由 Nginx 去掉 `/api` 后转发。

## CORE_MODULE

| 模块                           | 作用                                                      |
| ------------------------------ | --------------------------------------------------------- |
| ConfigModule                   | Zod 校验的应用配置（`ignoreEnvFile: true`，依赖进程环境） |
| ServeStatic + StaticfileModule | 静态目录与文件上传 API                                    |
| AppRedisModule                 | Redis 全局客户端与健康检查                                |
| RbacModule                     | 权限 Redis 缓存                                           |
| ThrottlerModule                | 全局限流（Redis 存储，默认 60s / 100 次）                 |
| PrismaModule                   | `PgService`                                               |
| WinstonLoggerModule            | 日志 + `/log` 访问日志 / 操作日志 API                     |

## CORE_SYSTEM_MODULE

| 模块             | 职责                                                          |
| ---------------- | ------------------------------------------------------------- |
| SessionModule    | Access/RT 令牌、会话吊销、领域事件（不依赖 Presence）         |
| AuthModule       | 注册/登录/刷新/登出、JWT Strategy                             |
| CaptchaModule    | SVG 图形/数学验证码                                           |
| UserModule       | 用户 CRUD、个人信息、头像、密码                               |
| RoleModule       | 角色与菜单权限分配                                            |
| MenuModule       | 菜单树 CRUD、排序                                             |
| PermissionModule | 按钮等权限 CRUD（挂菜单）                                     |
| DepartmentModule | 部门树                                                        |
| DictionaryModule | 字典类型/字典项                                               |
| StaticfileModule | 文件列表/上传/删除（亦在 core 侧挂载）                        |
| MonitorModule    | 系统快照 + `/monitor/ws`                                      |
| OnlineModule     | Presence：在线用户 + `/online/ws`，订阅会话事件踢人           |
| MessageModule    | 收件箱编排 + 投递应用服务 + MessageRepository + `/message/ws` |

## 全局 Guard 顺序

1. `GlobalThrottlerGuard` — 限流
2. `RtJwtAuthGuard` — Access JWT（仅 `@Public()` 跳过；静态资源由独立中间件处理，不走 Guard；WS 交由 Gateway 自鉴权）
3. `PermissionGuard` — `@RequiredPermission` 校验

## 横切能力（processor）

| 类型        | 已启用                    | 说明                                                        |
| ----------- | ------------------------- | ----------------------------------------------------------- |
| Pipe        | GlobalZodValidationPipe   | 请求体校验                                                  |
| Filter      | AllExceptionsFilter       | 统一异常                                                    |
| Interceptor | TransformInterceptor      | 成功响应包装为 `ResOp` `{ code, data, message, timestamp }` |
| Interceptor | OperationLogInterceptor   | 写 `UserOperationLog` 访问日志（部分路径跳过，含审计查询）  |
| Interceptor | MonitorLatencyInterceptor | 监控延迟采样                                                |

未全局启用但代码库存在的示例：部分 Middleware、Timeout/Idempotence Interceptor、PoliciesGuard（CASL 设想）等。

## WebSocket

| Gateway        | 路径          |
| -------------- | ------------- |
| OnlineGateway  | `/online/ws`  |
| MonitorGateway | `/monitor/ws` |
| MessageGateway | `/message/ws` |

使用 `@nestjs/platform-ws`；连接时自行校验 JWT（query 或 header）。

## 依赖要点（package.json）

- NestJS 11 全家桶、Passport JWT、argon2、Prisma 7 + `@prisma/adapter-pg`
- Redis：`@liaoliaots/nestjs-redis`、`ioredis`
- 队列：`@nestjs/bullmq` + `bullmq`（消息模块）
- 校验：`nestjs-zod` + `zod`
- 限流：`@nestjs/throttler` + Redis 存储
- 验证码：`svg-captcha`

## 测试

- 单元：Jest（`src/**/*.spec.ts`）
- E2E：`test/jest-e2e.json`
- 根脚本：`pnpm test` → `server` 的 `test:ci`
