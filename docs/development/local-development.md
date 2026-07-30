# 本地开发

## 环境要求

- Node.js ≥ 20.19（admin engines）；服务端镜像为 24.x
- pnpm 11.13.1（根 `packageManager`）
- 本地 PostgreSQL、Redis（或只用 Docker 起依赖）

## 安装

```bash
pnpm install
```

Workspace：`apps/*`、`packages/*`（见 `pnpm-workspace.yaml`）。

## 环境变量

1. 根目录可参考 `.env.example`
2. Server 本地常用 `apps/server/.env`，需包含 `PG_DATABASE_URL`、`TOKEN_*`、`REDIS_*` 等
3. Admin 使用 Vite mode：`dev` 脚本为 `--mode base`（`.env.base`）

## 数据库

```bash
cd apps/server
# 配置 PG_DATABASE_URL 后
pnpm prisma migrate dev
pnpm prisma:seed
```

## 启动

根脚本：

| 命令              | 作用                          |
| ----------------- | ----------------------------- |
| `pnpm dev:server` | Nest watch                    |
| `pnpm dev:admin`  | Vite，默认打开，端口 **4000** |
| `pnpm dev`        | apps 并行 dev                 |

Admin 代理：`/api` → `http://127.0.0.1:3000`（去掉 `/api`）。

## 质量门

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# 或一次性
pnpm check
```

Husky + lint-staged + commitlint（conventional）。

## 包过滤

```bash
pnpm --filter server <script>
pnpm --filter admin <script>
```
