# 环境变量

变量名与 Compose 注入以根目录 **`.env.example`** 和 **`compose.yml`** 为准。生成随机生产值：`pnpm env:generate` → **`.env.generated`**（`scripts/generate-production-env.mjs`，默认 `wx` 不覆盖已有文件）。

## 根目录（Compose / Server）

| 变量                                                | 用途                                                                  |
| --------------------------------------------------- | --------------------------------------------------------------------- |
| `NODE_ENV`                                          | 生产为 `production` 时 Zod 强制校验密钥与连接串                       |
| `PORT`                                              | HTTP 端口（默认 3000）                                                |
| `TOKEN_SECRET` / `TOKEN_REFRESH_SECRET`             | JWT 密钥（建议 ≥32 随机字符）                                         |
| `TOKEN_EXPIRES_TIME`                                | Access 过期（秒）                                                     |
| `TOKEN_REFRESH_EXPIRES_TIME`                        | Refresh 过期（秒）                                                    |
| `SSO_COUNT`                                         | 同用户最大会话数                                                      |
| `SWAGGER` / `SWAGGER_USERNAME` / `SWAGGER_PASSWORD` | Swagger 开关与 Basic Auth（仅 `SWAGGER=true` 时需要账号）             |
| `HELMET`                                            | 是否启用 helmet                                                       |
| `STATIC_FILE_ROOT_PATH`                             | 静态磁盘根（如 `public`）                                             |
| `STATIC_FILE_SERVE_ROOT`                            | 静态 URL 前缀（如 `api/public`）                                      |
| `SEED_ADMIN_USERNAME` / `PASSWORD` / `PHONE`        | 空库 Seed 超级管理员                                                  |
| `POSTGRES_DB`                                       | 库名                                                                  |
| `POSTGRES_ADMIN_USER` / `PASSWORD`                  | 超级用户                                                              |
| `POSTGRES_MIGRATOR_USER` / `PASSWORD`               | 迁移用户（密码须与另外两个不同）                                      |
| `POSTGRES_APP_USER` / `PASSWORD`                    | 运行时用户                                                            |
| `PG_DATABASE_URL`                                   | **migrate** 容器：Compose 原样注入为 Nest/Prisma 的 `PG_DATABASE_URL` |
| `APP_DATABASE_URL`                                  | **server** 容器：Compose 将其注入为进程内的 `PG_DATABASE_URL`         |
| `REDIS_HOST` / `PORT` / `PASSWORD`                  | Redis（Compose 服务名 `redis`）                                       |
| `DB_BACKUP_DIR`                                     | 容器内备份目录（默认 `/app/apps/server/backups`）                     |
| `DB_BACKUP_CRON` / `TIMEZONE` / `RETENTION_MAX`     | 定时备份                                                              |
| `DB_BACKUP_PREFIX` / `GZIP`                         | 备份文件名前缀与是否 gzip                                             |

### 命名注意

Nest 与 Prisma **只读 `PG_DATABASE_URL`**。Compose 里：

- `migrate`：`PG_DATABASE_URL` ← 宿主机 `.env` 的 `PG_DATABASE_URL`（迁移账号）
- `server`：`PG_DATABASE_URL` ← 宿主机 `.env` 的 `APP_DATABASE_URL`（运行账号）

本地 `apps/server/.env` 直接写 `PG_DATABASE_URL`。生产根目录 `.env` 必须同时提供上述两个 URL。

## Admin Vite

| 变量                              | `.env.base`（本地 `--mode base`） | `.env.pro`（`build:pro`） |
| --------------------------------- | --------------------------------- | ------------------------- |
| `VITE_API_BASE_PATH`              | `api/`                            | `/api/`                   |
| `VITE_BASE_PATH`                  | `/`                               | `/`                       |
| `VITE_APP_TITLE`                  | 见文件                            | 见文件                    |
| `VITE_OUT_DIR`                    | —                                 | `dist-pro`                |
| `VITE_DROP_CONSOLE` / `DEBUGGER`  | —                                 | true                      |
| `VITE_SOURCEMAP`                  | —                                 | false                     |
| `VITE_OSS_PUBLIC_BUCKET`          | `public`                          | `public`                  |
| `VITE_USE_ALL_ELEMENT_PLUS_STYLE` | true                              | true                      |
| `VITE_HIDE_GLOBAL_SETTING`        | false                             | false                     |

生产构建必须用 **`/api/`**（绝对路径）。`api/` 仅给本地 Vite 开发代理。文件：`apps/admin/.env.base`、`.env.dev`、`.env.pro`。

## Server 配置加载

`apps/server/src/core/config/index.ts`：

- `ConfigModule.forRoot({ ignoreEnvFile: true, ... })` — 不自动读 `.env` 文件，依赖进程环境（Compose `env_file` 或本地自行注入）
- `NODE_ENV=production` 时 Zod 校验密钥与 `PG_DATABASE_URL`
