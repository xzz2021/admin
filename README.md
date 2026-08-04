> 项目整体结构,目录,架构设计详细文档在根目录[/docs](./docs/)下

> 本地开发

前置准备

- git/node24/pnpm11.13.1
- 本机要有redis和postgres数据库,配置在[server](./apps//server/)的.env文件
- prisma首次初始化数据库表`prisma migrate dev --name init `,还需要初始化种子数据,[server](./apps//server/)项目下执行`pnpm prisma:seed`,为了避免数据冲突,增量需要自行构造查询写入逻辑,文件在[seeds](./apps/./server/src/prisma/seed.ts)（例如消息收件箱/管理菜单拆分会在已有库上自动 ensure）
- 每次更新schema后需要执行`pnpm generate`
- 如果想调试数据库备份服务,需要本机(win10)安装PostgreSQL Command Line Tools命令行工具并设置环境变量

> 部署相关

前置准备

1. 复制环境变量：`cp .env.example .env`，按需修改密码与密钥
2. Linux 创建可写数据目录（与容器 `node` uid 1000 对齐）：`mkdir -p data/server/{public,backups} && chown -R 1000:1000 data/server`否则数据库备份会没有权限
3. compose使用了外部的docker代理网络,需要确保 Nginx Proxy Manager 有创建和加入 `shared` 网络,后期优化成独立网络
4. 提交文件一律为LF `git config core.autocrlf input`

首次构建启动

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

后期附参考图

### 停止服务（不删除 volume）

```bash
docker compose down
```

### 更新代码后重建

```bash
docker compose up -d --build
```

### 仅重新跑数据库迁移：

```bash
docker compose run --rm migrate
```

### 说明

- 内网只保留 admin 容器内 1 个 nginx（托管 SPA）
- `migrate` 使用 Dockerfile 的 `migrator` 阶段；`server` 使用 `runner` 阶段
- prisma7不兼容node26,故使用node24
- 清理docker部署CACHE残留: `docker system prune -a --volumes -f`

### 部署

如果只更新admin的nginx.conf

1.  拷进正在跑的 admin 容器
    docker cp apps/admin/nginx.conf app-admin:/etc/nginx/conf.d/default.conf
2.  检查配置
    docker exec app-admin nginx -t
3.  平滑重载（不断服务）
    docker exec app-admin nginx -s reload
