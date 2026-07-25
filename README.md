部署相关

## 前置

1. 复制环境变量：`cp .env.example .env`，按需修改密码与密钥
2. 创建外部网络（仅首次）：`docker network create shared`
3. 确保 Nginx Proxy Manager 也加入 `shared` 网络
4. 提交文件一律为LF `git config core.autocrlf input`

## 首次构建启动

```bash
docker compose -f compose.yml up -d --build
```

启动顺序：postgres/redis healthy → migrate（一次性 exit 0）→ server / admin

本 compose **不对外暴露端口**。对外访问由 NPM 在 `shared` 网络上反代：

| 用途     | 转发目标（服务名）   |
| -------- | -------------------- |
| 前端     | `http://admin:80`    |
| 后端 API | `http://server:3000` |

前端 `VITE_API_BASE_PATH=api/`：若前后端同域名，NPM 需把 `/api` 转到 server，并去掉 `/api` 前缀（与开发时 Vite proxy 一致）。

WebSocket（`/api/online/ws`、`/api/message/ws`、`/api/monitor/ws`）走同一 `/api` 反代：

- **admin 容器内 nginx** 已配置 `Upgrade` / `Connection` 与更长的 `proxy_read_timeout`
- **外层 Nginx Proxy Manager**：对应 Proxy Host 打开 Websockets Support；若 NPM 直接反代 `server:3000` 而非经 admin，也需开启 WS

## 停止服务（不删除 volume）

```bash
docker compose down
```

## 更新代码后重建

```bash
docker compose up -d --build
```

仅重新跑数据库迁移：

```bash
docker compose run --rm migrate
```

## 说明

- 内网只保留 admin 容器内 1 个 nginx（托管 SPA）
- `migrate` 使用 Dockerfile 的 `migrator` 阶段；`server` 使用 `runner` 阶段
- prisma7不兼容node26,故使用node24
- 清理docker残留: `docker system prune -a --volumes -f`
