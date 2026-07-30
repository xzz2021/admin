# Prisma 使用说明

## 位置

| 路径                                          | 说明                                |
| --------------------------------------------- | ----------------------------------- |
| `apps/server/src/prisma/schema/schema.prisma` | Schema                              |
| `apps/server/src/prisma/migrations/`          | 迁移                                |
| `apps/server/src/prisma/generated/prisma`     | Client 输出                         |
| `apps/server/src/prisma/generated/zod`        | Zod DTO 输出（nestjs-zod-prisma）   |
| `apps/server/src/prisma/pg.service.ts`        | Nest 注入的 Prisma 封装             |
| `apps/server/src/prisma/lib/prisma.ts`        | Client 工厂（读 `PG_DATABASE_URL`） |

## Generator

- `prisma-client`：`moduleFormat = cjs`，输出到 `generated/prisma`
- `nestjs-zod-prisma`：根据 `/// @z.xxx` 注释生成 DTO

Datasource：`provider = postgresql`（URL 来自环境，不在 schema 写死）。

## 常用命令

在 `apps/server` 或 `--filter server` 下：

```bash
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma migrate deploy   # 生产 / migrator 镜像
pnpm prisma db seed
```

Docker `migrate` 服务：`prisma migrate deploy && prisma db seed`。

## Nest 集成

- `PrismaModule` 全局导出 `PgService`
- 业务 Service 注入 `PgService` 访问模型
- 路径别名：`@prisma/generated/...`、`@prisma/lib/...`（见 Jest / tsconfig）

## 实践注意

1. 运行时与迁移均使用环境变量 **`PG_DATABASE_URL`**（Compose 分别从 APP_/MIGRATION_ 映射）
2. 复杂写入使用事务（Seed、角色权限分配等）
3. Prisma 7 与 Node 26 不兼容；镜像使用 Node 24（见根 README）
4. Windows 上 `@hatkom/nestjs-zod-prisma` 的 preinstall 被 workspace `allowBuilds` 跳过

## Schema 与代码差异（勿误用）

| 模型     | 状态                                       |
| -------- | ------------------------------------------ |
| Notice   | 仅 Schema，无业务 API                      |
| AuditLog | 仅 Schema；线上操作日志走 UserOperationLog |
