# 代码地图

快速定位「功能 → 路径」。

## Monorepo

| 路径                                  | 说明                                      |
| ------------------------------------- | ----------------------------------------- |
| `package.json`                        | 根脚本：dev/build/lint/check/env:generate |
| `pnpm-workspace.yaml`                 | apps/_、packages/_                        |
| `compose.yml`                         | 生产编排                                  |
| `.env.example`                        | 环境变量模板                              |
| `scripts/generate-production-env.mjs` | 生成生产 env                              |
| `docker/postgres/`                    | DB 用户初始化                             |
| `packages/`                           | config / types / utils                    |

## Backend `apps/server/src`

| 路径                          | 说明                                |
| ----------------------------- | ----------------------------------- |
| `main.ts`                     | 启动引导                            |
| `app.module.ts`               | 根模块                              |
| `core/`                       | Config、Redis、静态、Swagger、日志  |
| `core/app.core.ts`            | CORE_MODULE + GLOBAL_GUARD          |
| `system/app.system.ts`        | 业务模块聚合                        |
| `system/auth/`                | 认证                                |
| `system/user/`                | 用户                                |
| `system/role/`                | 角色                                |
| `system/menu/`                | 菜单                                |
| `system/permission/`          | 权限 CRUD                           |
| `system/department/`          | 部门                                |
| `system/dictionary/`          | 字典                                |
| `system/captcha/`             | 验证码                              |
| `system/staticfile/`          | 文件                                |
| `system/monitor/`             | 监控 + WS                           |
| `system/online/`              | 在线 + WS                           |
| `system/message/`             | 消息 + BullMQ + WS                  |
| `processor/guard/`            | JWT、Permission、Throttler、Captcha |
| `processor/decorator/`        | Public、RequiredPermission          |
| `processor/interceptor/`      | 响应转换、操作日志                  |
| `processor/rbac/`             | 权限缓存                            |
| `prisma/schema/schema.prisma` | 数据模型                            |
| `prisma/seed.ts`              | 种子入口                            |

## Frontend `apps/admin/src`

| 路径                        | 说明                     |
| --------------------------- | ------------------------ |
| `main.ts` / `permission.ts` | 入口与路由守卫           |
| `router/index.ts`           | 常量/本地异步路由        |
| `axios/`                    | HTTP 与 token 刷新       |
| `api/`                      | 分域 API                 |
| `store/modules/`            | Pinia                    |
| `views/Authorization/`      | 部门/用户/菜单/角色/字典 |
| `views/System/`             | 文件/消息/在线/监控/日志 |
| `views/Dashboard/`          | 分析/工作台              |
| `directives/permission/`    | v-hasPermi               |
| `hooks/fn/useRoleMenu.ts`   | 拉菜单并生成路由         |
| `utils/routerHelper.ts`     | 动态路由组件映射         |
| `nginx.conf` / `Dockerfile` | 前端镜像与反代           |
