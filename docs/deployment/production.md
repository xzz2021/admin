# 生产部署指南

操作清单。镜像/网络细节见 [docker.md](./docker.md)，变量见 [environment.md](./environment.md)。

## 前置

1. 环境变量：`cp .env.example .env`，或 `pnpm env:generate` 后审阅并合并进 `.env`。填好密码、密钥，以及 **`PG_DATABASE_URL`（迁移账号）和 `APP_DATABASE_URL`（运行账号）**。
2. 数据目录（与镜像内 `node` uid **1000** 对齐，否则备份/上传/日志会 EACCES）：

   ```bash
   mkdir -p data/server/{public,backups,logs}
   chown -R 1000:1000 data/server
   ```

3. 外部网络（名称必须与 `compose.yml` 一致）：

   ```bash
   docker network create shared_net
   ```

   Nginx Proxy Manager 必须加入该网络。

4. Git 换行：`git config core.autocrlf input`（仓库文件为 LF）

## 启动

```bash
docker compose -f compose.yml up -d --build
```

postgres/redis healthy → migrate 一次成功退出 → server、admin。

## 反代（推荐拓扑）

Compose **不对外暴露端口**。浏览器只打到 NPM，NPM 只反代 **admin**：

```
浏览器 → NPM（shared_net）→ http://admin:80
                              ├─ 静态 SPA
                              └─ /api/* → server:3000（admin Nginx 去掉 /api）
```

| NPM Proxy Host | 值                                                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forward        | `http://admin:80`                                                                                                                                 |
| Websockets     | 开启                                                                                                                                              |
| 真实 IP        | 开启 Websockets；保留 NPM 默认的 `X-Forwarded-For` / `X-Forwarded-Proto`。admin Nginx 只用私网对端的转发头，并覆盖后传给 server，客户端无法伪造。 |

生产前端 `VITE_API_BASE_PATH=/api/`（`.env.pro`）。请求与页面同源，由 admin Nginx 处理 `/api`，**不要**再为同一域名把 `/api` 指到 `server:3000`，否则会和容器内反代叠两层或绕开安全头。

可选替代（与推荐互斥）：NPM 将 `/` 指 `admin:80`、将 `/api` 直连 `server:3000` 并去掉前缀。此时须在 NPM 上单独开 Websockets，且不要再让 `/api` 进入 admin Nginx。

WebSocket 路径：`/api/online/ws`、`/api/message/ws`、`/api/monitor/ws`。

## 安全清单

- `SWAGGER=false`（默认）
- `HELMET=true`
- Postgres 三个角色密码互不相同
- Token / Redis 使用高熵随机值
- 不映射宿主机端口，只经受控反代

## 更新与维护

```bash
docker compose -f compose.yml up -d --build   # 代码更新后重建
docker compose run --rm migrate                 # 仅迁移+seed
docker compose down                             # 停服务保留卷
```

热更新 Nginx：见 [docker.md](./docker.md)（文件是 `docker/nginx/nginx.conf`，容器名 `app-admin`）。

清理缓存（会删未使用镜像/卷，慎用）：`docker system prune -a --volumes -f`

Prisma 7 使用 Node 24 镜像（与 `apps/server/Dockerfile` 的 `node:24.18` 一致，不要用 Node 26）。

## CI

`.github/workflows/ci.yml`：install → `pnpm check`。无自动部署。
