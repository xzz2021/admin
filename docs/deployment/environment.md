# 环境变量

## 根目录（Compose / Server）

模板：`.env.example`。生产可用 `pnpm env:generate` → 生成 `.env.generated`（`scripts/generate-production-env.mjs`）。

| 变量                                                | 用途                                 |
| --------------------------------------------------- | ------------------------------------ |
| `NODE_ENV`                                          | 生产校验开关相关                     |
| `PORT`                                              | HTTP 端口（默认 3000）               |
| `TOKEN_SECRET` / `TOKEN_REFRESH_SECRET`             | JWT 密钥（建议 ≥32 随机字符）        |
| `TOKEN_EXPIRES_TIME`                                | Access 过期秒                        |
| `TOKEN_REFRESH_EXPIRES_TIME`                        | Refresh 过期秒                       |
| `SSO_COUNT`                                         | 同用户最大会话数                     |
| `SWAGGER` / `SWAGGER_USERNAME` / `SWAGGER_PASSWORD` | Swagger 开关与 Basic Auth            |
| `HELMET`                                            | 是否启用 helmet                      |
| `STATIC_FILE_ROOT_PATH`                             | 静态磁盘根（如 `public`）            |
| `STATIC_FILE_SERVE_ROOT`                            | 静态 URL 前缀（如 `api/public`）     |
| `SEED_ADMIN_USERNAME` / `PASSWORD` / `PHONE`        | 空库 Seed 管理员                     |
| `POSTGRES_DB`                                       | 库名                                 |
| `POSTGRES_ADMIN_USER` / `PASSWORD`                  | 超级用户                             |
| `POSTGRES_MIGRATOR_USER` / `PASSWORD`               | 迁移用户（密码须不同）               |
| `POSTGRES_APP_USER` / `PASSWORD`                    | 运行时用户                           |
| `MIGRATION_DATABASE_URL`                            | migrate 容器映射为 `PG_DATABASE_URL` |
| `APP_DATABASE_URL`                                  | server 容器映射为 `PG_DATABASE_URL`  |
| `REDIS_HOST` / `PORT` / `PASSWORD`                  | Redis                                |

### 命名注意

Nest Config 与 Prisma 运行时读取的是 **`PG_DATABASE_URL`**。Compose 用 `APP_DATABASE_URL` / `MIGRATION_DATABASE_URL` 注入该名。本地 `apps/server/.env` 通常直接写 `PG_DATABASE_URL`。

## Admin Vite

| 变量                              | base    | pro（生产构建） |
| --------------------------------- | ------- | --------------- |
| `VITE_API_BASE_PATH`              | `api/`  | `/api/`         |
| `VITE_BASE_PATH`                  | `/`     | `/`             |
| `VITE_APP_TITLE`                  | xzz2021 | xzz2021         |
| `VITE_OUT_DIR`                    | —       | `dist-pro`      |
| `VITE_DROP_CONSOLE` / `DEBUGGER`  | —       | true            |
| `VITE_SOURCEMAP`                  | —       | false           |
| `VITE_USE_ALL_ELEMENT_PLUS_STYLE` | true    | true            |
| `VITE_HIDE_GLOBAL_SETTING`        | false   | false           |

文件：`apps/admin/.env.base`、`.env.dev`、`.env.pro`。

## Server 配置加载

`apps/server/src/core/config/index.ts`：

- `ConfigModule.forRoot({ ignoreEnvFile: true, ... })` — 依赖进程环境，不自动读 `.env` 文件（本地需自行注入或由工具加载）
- 生产 `NODE_ENV=production` 时 Zod 强制校验关键密钥与连接串
