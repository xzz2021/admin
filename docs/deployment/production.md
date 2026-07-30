# 生产部署指南

## 前置

1. 复制并填写环境变量：`cp .env.example .env`（或先 `pnpm env:generate` 再审阅迁移）
2. 创建外部网络：`docker network create shared_net`（与 `compose.yml` 一致）
3. 将 Nginx Proxy Manager（或其它反代）加入同一外部网络
4. Git 换行建议 LF：`git config core.autocrlf input`

## 启动

```bash
docker compose -f compose.yml up -d --build
```

顺序：postgres/redis healthy → migrate 成功退出 → server / admin。

## 反代建议

| 用途   | 目标                 |
| ------ | -------------------- |
| 前端   | `http://admin:80`    |
| 仅 API | `http://server:3000` |

若前后端同域名：把 `/api` 转到 server 并去掉前缀（与 Vite 开发代理、admin 容器内 nginx 行为一致）。

WebSocket 路径：`/api/online/ws`、`/api/message/ws`、`/api/monitor/ws`

- admin 内 nginx 已配置 Upgrade / 长超时
- 外层 NPM 需打开 Websockets Support

## 安全清单

- `SWAGGER=false`（默认）；若开启必须强密码
- `HELMET=true`
- Postgres 三角色密码互不相同
- Token / Redis 密码使用高熵随机值
- Compose 不映射宿主机端口，仅内网 + 受控反代

## 更新与维护

```bash
docker compose up -d --build          # 代码更新重建
docker compose run --rm migrate       # 仅迁移+seed
docker compose down                   # 停服务保留卷
```

清理残留（慎用）：`docker system prune -a --volumes -f`

Prisma 7 使用 Node 24 镜像（不兼容 Node 26）。

## CI

`.github/workflows/ci.yml`：install → `pnpm check`（lint + typecheck + test + build）。无自动部署流水线。
