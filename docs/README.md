# 项目技术文档

基于 NestJS 11 + Prisma + PostgreSQL + Redis + Vue3 的后台管理系统（pnpm monorepo）。

## 文档导航

| 分类     | 文档                                                                                                                                                                | 说明            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 架构     | [system-design](./architecture/system-design.md)                                                                                                                    | 系统架构总览    |
|          | [backend](./architecture/backend.md)                                                                                                                                | 后端模块与分层  |
|          | [frontend](./architecture/frontend.md)                                                                                                                              | 前端结构与路由  |
|          | [permission](./architecture/permission.md)                                                                                                                          | RBAC 权限设计   |
|          | [data-flow](./architecture/data-flow.md)                                                                                                                            | 关键数据流      |
| 数据库   | [database-design](./database/database-design.md)                                                                                                                    | 表结构与关系    |
|          | [prisma-guide](./database/prisma-guide.md)                                                                                                                          | Prisma 使用说明 |
| 业务模块 | [auth](./modules/auth.md) / [user](./modules/user.md) / [role](./modules/role.md) / [permission](./modules/permission.md)                                           | 核心业务        |
| API      | [api-overview](./api/api-overview.md) / [authentication](./api/authentication.md)                                                                                   | 接口与鉴权      |
| 部署     | [docker](./deployment/docker.md) / [environment](./deployment/environment.md) / [production](./deployment/production.md)                                            | Docker 与生产   |
| 开发     | [local-development](./development/local-development.md) / [coding-standard](./development/coding-standard.md) / [extension-guide](./development/extension-guide.md) | 本地开发与扩展  |
| 其他     | [common-problems](./troubleshooting/common-problems.md) / [code-map](./code-map.md)                                                                                 | 排障与代码地图  |

## 仓库结构（简要）

```
backstage/
├── apps/
│   ├── admin/          # Vue3 管理后台
│   └── server/         # NestJS API
├── packages/           # 共享包（config / types / utils）
├── docker/postgres/    # Postgres 初始化脚本
├── scripts/            # 生产环境变量生成等
├── compose.yml         # 生产编排
└── docs/               # 本目录
```

## 技术栈

| 层       | 技术                                                         |
| -------- | ------------------------------------------------------------ |
| 前端     | Vue 3.5、TypeScript、Vite 6、Element Plus、Pinia、Vue Router |
| 后端     | NestJS 11、Prisma 7、Passport JWT、Zod、BullMQ、Winston      |
| 数据     | PostgreSQL 18、Redis 8                                       |
| 基础设施 | Docker Compose、Nginx（admin 容器）、pnpm workspace          |

## 快速入口

- 本地开发：见 [local-development](./development/local-development.md)
- Docker 部署：见 [docker](./deployment/docker.md)
- 权限模型：见 [permission](./architecture/permission.md)
- 代码定位：见 [code-map](./code-map.md)
