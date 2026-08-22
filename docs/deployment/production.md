# 生产部署指南

## 前置

1. 复制并填写环境变量：`cp .env.example .env`（或先 `pnpm env:generate` 再审阅迁移）,按需修改密码与密钥
2. Linux 创建可写数据目录（与容器 `node` uid 1000 对齐）：`mkdir -p data/server/{public,backups} && chown -R 1000:1000 data/server`否则数据库备份会没有权限
3. compose使用了外部的docker代理网络,需要确保 Nginx Proxy Manager 有创建和加入 `shared_net` 网络, `docker network create shared_net`（与 `compose.yml` 一致）, 后期优化成独立网络
4. 提交文件一律为LF `git config core.autocrlf input`

## 启动

```bash
docker compose -f compose.yml up -d --build
```

顺序：postgres/redis healthy → migrate 成功退出（一次性 exit 0） → server / admin。

## 反代建议

本 compose **不对外暴露端口**。对外访问由 NPM 在 `shared_net` 网络上反代：

| 用途     | 转发目标（服务名）   |
| -------- | -------------------- |
| 前端     | `http://admin:80`    |
| 后端 API | `http://server:3000` |

前端 `VITE_API_BASE_PATH=api/`：若前后端同域名，NPM 需把 `/api` 转到 server，并去掉 `/api` 前缀（与开发时 Vite proxy 一致）。

WebSocket（`/api/online/ws`、`/api/message/ws`、`/api/monitor/ws`）走同一 `/api` 反代：

- **admin 容器内 nginx** 已配置 `Upgrade` / `Connection` 与更长的 `proxy_read_timeout`
- **外层 Nginx Proxy Manager**：对应 Proxy Host 打开 Websockets Support；若 NPM 直接反代 `server:3000` 而非经 admin，也需开启 WS, 同时要拿到真实ip必须每层代理都设置

```
# nginx.conf
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

## 安全清单

- `SWAGGER=false`（默认）
- `HELMET=true`
- Postgres 三角色密码互不相同
- Token / Redis 密码使用高熵随机值
- Compose 不映射宿主机端口，仅内网 + 受控反代

## 更新与维护

```bash
docker compose up -d --build          # 代码更新后重建打包
docker compose run --rm migrate       # 仅迁移+seed
docker compose down                   # 停服务保留卷
```

清理残留（慎用）：`docker system prune -a --volumes -f`

Prisma 7 使用 Node 24 镜像（不兼容 Node 26）。

## CI

`.github/workflows/ci.yml`：install → `pnpm check`（lint + typecheck + test + build）。无自动部署流水线。

### 说明

- 内网只保留 admin 容器内 1 个 nginx（托管 SPA）
- `migrate` 使用 Dockerfile 的 `migrator` 阶段；`server` 使用 `runner` 阶段
- prisma7不兼容node26,故使用node24
- 清理docker部署CACHE残留: `docker system prune -a --volumes -f`

### 补充

如果只更新admin的nginx.conf

1.  拷进正在跑的 admin 容器
    docker cp apps/admin/nginx.conf app-admin:/etc/nginx/conf.d/default.conf
2.  检查配置
    docker exec app-admin nginx -t
3.  平滑重载（不断服务）
    docker exec app-admin nginx -s reload
