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

1. 后端Server使用 `apps/server/.env`，需包含 `PG_DATABASE_URL`、`TOKEN_*`、`REDIS_*` 等
2. 前端Admin 使用 Vite mode：`dev` 脚本为 `--mode base`（`.env.base`）

## 数据库

- prisma首次初始化数据库表prisma migrate dev --name init,还需要初始化种子数据,server项目下执行pnpm prisma:seed,为了避免数据冲突,增量需要自行构造查询写入逻辑,文件在seeds,用于初始化菜单和超级管理员账号; 如果是后期开发已有迁移数据而开发时数据库有重置,则执行pnpm exec prisma migrate deploy再执行pnpm exec prisma db seed以保持迁移记录一致
- 每次更新schema后需要执行pnpm generate同步prisma client,执行prisma migrate dev --name anyname同步数据库
- 如果想调试数据库备份功能,需要本机(win10)安装PostgreSQL Command Line Tools命令行工具并设置环境变量

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
