# Docker 部署

## 编排文件

根目录 `compose.yml`，服务：

| 服务     | 镜像/构建                            | 说明                                                                               |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| postgres | postgres:18-alpine                   | 数据卷 `postgres-data`；挂载 `docker/postgres/init-users.sh`                       |
| redis    | redis:8-alpine                       | 密码 + AOF；卷 `redis-data`                                                        |
| migrate  | server Dockerfile `target: migrator` | 一次性：`migrate deploy && db seed`                                                |
| server   | server Dockerfile `target: runner`   | 健康检查 `GET /health`；bind mount `./data/server/public`、`./data/server/backups` |
| admin    | admin Dockerfile                     | Nginx 托管 SPA；依赖 server healthy                                                |

网络：

- `app-network`：内部通信
- `shared_net`：`external: true`，供 Nginx Proxy Manager 等接入

**不暴露宿主机 ports**。对外由外部反代访问 `admin:80` / `server:3000`。

> 根 README 写 `docker network create shared`；compose 实际网络名为 **`shared_net`**。创建时请与 compose 一致：`docker network create shared_net`。

## Dockerfile 要点

### server（`apps/server/Dockerfile`）

1. **builder**：Node 24.18，pnpm 11.13.1，`prisma generate` + `nest build`
2. **migrator**：继承 builder，跑迁移与 seed
3. **runner**：alpine 生产依赖，额外安装 `postgresql18-client` 供 `pg_dump` 备份；`node dist/src/main.js`，USER node，EXPOSE 3000

### admin（`apps/admin/Dockerfile`）

1. **builder**：`pnpm --filter admin build:pro`
2. **runtime**：`nginx:1.31-alpine`，拷贝 `dist-pro` + `nginx.conf`

## admin Nginx（`apps/admin/nginx.conf`）

- SPA：`try_files` → `index.html`
- `location ^~ /api/` → `proxy_pass http://server:3000/`（剥离 `/api`）
- WebSocket Upgrade；读写超时 3600s；`client_max_body_size 20m`
- 安全响应头与静态缓存

## 常用命令

```bash
cp .env.example .env   # 修改密钥与密码
# Linux：先创建 bind 目录并交给容器内 node（uid 1000），避免 Docker 以 root 建目录导致 EACCES
mkdir -p data/server/public data/server/backups
chown -R 1000:1000 data/server
docker network create shared_net
docker compose -f compose.yml up -d --build
docker compose down
docker compose run --rm migrate   # 仅迁移
```

数据库备份相关环境变量：

```bash
DB_BACKUP_DIR=/app/apps/server/backups
DB_BACKUP_CRON=0 0 * * * *
DB_BACKUP_TIMEZONE=Asia/Shanghai
DB_BACKUP_RETENTION_MAX=24
DB_BACKUP_PREFIX=backstage_db
DB_BACKUP_GZIP=true
```

仅热更新 nginx 配置（根 README）：

```bash
docker cp apps/admin/nginx.conf app-admin:/etc/nginx/conf.d/default.conf
docker exec app-admin nginx -t
docker exec app-admin nginx -s reload
```

## 其它

- `.dockerignore`：排除 node_modules、多数 .env、测试等；放行 `apps/admin/.env.pro`、`dist-pro` 等
- 已有库角色迁移 SQL：`docker/postgres/migrate-existing-users.sql`（**未**挂入 compose，需手动）
- 备份与静态上传走宿主机 bind mount：`./data/server/backups`、`./data/server/public`（勿用命名卷，避免 root 属主导致 `node` 无法写入）；对外下载仍走后端鉴权接口
- 首次部署前请 `mkdir -p data/server/{public,backups} && chown -R 1000:1000 data/server`（与镜像内 `node` uid 对齐）
- `server` 生产镜像固定安装 PostgreSQL 18 客户端，与 Compose 中的 PostgreSQL 18 服务端保持主版本一致
- 数据库备份通过 BullMQ 队列异步执行（Queue 与 Processor 同在 server 容器），定时任务使用 repeatable job；`attempts=1`
- 立即备份使用固定 `jobId=db-backup:manual` 幂等入队；定时备份使用 `upsertJobScheduler(db-backup:scheduled)`，配置未变时不重设
- 数据库备份菜单及 `databaseBackup:view/update/run/download/delete` 权限由 Seed 写入
- CI（`.github/workflows/ci.yml`）只跑 `pnpm check`，不构建/推送镜像
