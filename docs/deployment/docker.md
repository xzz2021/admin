# Docker 部署

编排与镜像的事实来源。生产操作步骤见 [production.md](./production.md)，变量名见 [environment.md](./environment.md)。

## 编排文件

根目录 **`compose.yml`**（另有 `compose.local.yml`，只起本机 Postgres/Redis，并映射宿主机端口，不用于生产）。

| 服务     | 镜像/构建                            | 说明                                                                               |
| -------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| postgres | postgres:18-alpine                   | 卷 `postgres-data`；挂载 `docker/postgres/init-users.sh` 初始化管理/迁移/运行账号  |
| redis    | redis:8-alpine                       | 密码 + AOF；卷 `redis-data`                                                        |
| migrate  | server Dockerfile `target: migrator` | 一次性：`migrate deploy && db seed`，成功后退出                                    |
| server   | server Dockerfile `target: runner`   | 健康检查 `GET /health`；bind mount `./data/server/public`、`./data/server/backups` |
| admin    | admin Dockerfile                     | Nginx 托管 SPA；依赖 server healthy                                                |

启动顺序：postgres/redis healthy → migrate 成功退出 → server / admin。

### 网络与端口

- 外部网络名 **`shared_net`**（`external: true`），给 Nginx Proxy Manager 等接入。
- 宿主机需先执行：`docker network create shared_net`
- **不映射宿主机 ports**。对外只应让 NPM 访问 `admin:80`；`/api` 由 admin 容器内 Nginx 转到 `server:3000`（见下方）。不要再单独把 `/api` 指到 `server:3000`，除非明确改用「NPM 分流」拓扑（见 production.md）。

## Dockerfile 要点

### server（`apps/server/Dockerfile`）

1. **builder**：`HUSKY=0` + `verify-deps-before-run=false`，`pnpm --filter server...` 安装，再 `prisma generate` + `nest build`（避免 pnpm 11 在脚本前把 admin/husky 再装一遍）
2. **migrator**：继承 builder，跑迁移与 seed
3. **runner**：alpine 生产依赖；安装 `postgresql18-client` 供 `pg_dump`；`USER node`（uid 1000）；EXPOSE 3000

### admin（`apps/admin/Dockerfile`）

1. **builder**：`HUSKY=0` + `verify-deps-before-run=false`，只装 admin 依赖后 `build:pro`，产出 `apps/admin/dist-pro`（不会再装 prisma / 跑 husky）
2. **runtime**：`nginx:1.31-alpine`，拷贝 `dist-pro` 与 **`docker/nginx/nginx.conf`** → `/etc/nginx/conf.d/default.conf`

## admin Nginx（`docker/nginx/nginx.conf`）

- SPA：`try_files` → `index.html`
- `location ^~ /api/` → `proxy_pass http://server:3000/`（去掉 `/api` 前缀）
- WebSocket：`Upgrade` / `Connection`；读写超时 3600s；`client_max_body_size 20m`
- 信任边界：`real_ip` 仅从 Docker 私网采纳 `X-Forwarded-For`，再用 `$remote_addr` 覆盖 `X-Real-IP` / `X-Forwarded-For`；`X-Forwarded-Proto` 仅允许受信任对端的 `http`/`https`
- 安全响应头：CSP 的 `script-src` 仅为 `'self'`（无 `unsafe-inline` / `unsafe-eval`）；静态缓存

热更新正在跑的容器（配置在宿主机改完后）：

```bash
docker cp docker/nginx/nginx.conf app-admin:/etc/nginx/conf.d/default.conf
docker exec app-admin nginx -t
docker exec app-admin nginx -s reload
```

## 其它

- `.dockerignore`：排除 node_modules、多数 `.env`、测试等；放行 `apps/admin/.env.pro`、`dist-pro` 等
- 空数据卷首次 initdb 会跑 `docker/postgres/init-users.sh`。已有卷补用户见 `docker/postgres/migrate-existing-users.sql`
- 备份与上传目录必须是宿主机 bind mount（`./data/server/backups`、`./data/server/public`），且属主为 uid 1000，与镜像内 `node` 一致
- 数据库备份由 server 内 BullMQ 执行；环境变量见 [environment.md](./environment.md)
- CI（`.github/workflows/ci.yml`）只跑 `pnpm check`，不构建/推送镜像
