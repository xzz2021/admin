> 项目结构、架构设计与部署说明见 [docs](./docs/)

## 项目说明

前端基于 [vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin) 二开，后端为 NestJS + Prisma + PostgreSQL，Docker 构建部署的全栈后台管理系统（pnpm monorepo）。

在线 Demo：[admin.xzz2021.top](https://admin.xzz2021.top/)

已完成 JWT + RBAC + DataScope + CASL 的细粒度权限，精确到字段级控制。

### 权限链路

RBAC 决定「你有什么身份和基础权限」；DataScope 决定「你能看到哪些行」；CASL 把权限、数据范围和当前资源状态组合起来，回答「现在能不能对这条数据做这件事」。

1. Controller 用 `@RequiredPermission` 声明所需权限码
2. 全局 `PermissionGuard` 读取用户权限（RBAC），不匹配则拦截
3. Service 经 Policy 适配器生成 Prisma `WHERE`（行级过滤）和 CASL Ability
4. 查询结果再经 project 策略处理：行级操作权限、敏感字段脱敏、特殊字段过滤

   > controller 里使用 RequiredPermission 装饰器传入需要的code权限码,全局守卫 APP_GUARD 引入 PermissionGuard 用于鉴权, PermissionGuard 调用 AuthorizationContext 查询当前用户所有权限信息(从数据库读取的原始权限数据结构), 构建上下文, 并判断受否拥有当前权限(rbac), 如果放行则进入 service 同时将 context 传入 policy, service 首先调用 Policy 授权适配器用于生产 Prisma WHERE 和 CASL Ability, queryWhere构建数据库的where筛选条件; 数据库范围条件过滤完, 再靠 project 策略决定每一行的操作权限及敏感数据字段的脱敏和特殊字段的过滤.

## 技术栈

### 前端 `apps/admin`

| 技术                                            | 说明        | 版本 |
| ----------------------------------------------- | ----------- | ---- |
| [Vue](https://cn.vuejs.org/)                    | UI 框架     | 3.5  |
| [Vite](https://cn.vitejs.dev/)                  | 开发与构建  | 6    |
| [Element Plus](https://element-plus.org/zh-CN/) | 组件库      | 2.9  |
| [TypeScript](https://www.typescriptlang.org/)   | 类型系统    | 5.7  |
| [Pinia](https://pinia.vuejs.org/)               | 状态管理    | 2.3  |
| [Vue Router](https://router.vuejs.org/)         | 路由        | 4.5  |
| [UnoCSS](https://unocss.dev/)                   | 原子 CSS    | 0.65 |
| [Axios](https://axios-http.com/)                | HTTP 客户端 | 1.7  |
| [vue-i18n](https://vue-i18n.intlify.dev/)       | 国际化      | 11   |

### 后端 `apps/server`

| 技术                                            | 说明               | 版本 |
| ----------------------------------------------- | ------------------ | ---- |
| [NestJS](https://nestjs.com/)                   | 服务端框架         | 11   |
| [Prisma](https://www.prisma.io/)                | ORM                | 7    |
| [PostgreSQL](https://www.postgresql.org/)       | 主数据库           | —    |
| [Redis](https://redis.io/)                      | 缓存 / 会话 / 限流 | —    |
| [Passport JWT](https://www.passportjs.org/)     | 鉴权               | —    |
| [CASL](https://casl.js.org/)                    | 字段级授权         | 7    |
| [Zod](https://zod.dev/)                         | 请求校验           | 4    |
| [BullMQ](https://docs.bullmq.io/)               | 消息队列           | 5    |
| [Winston](https://github.com/winstonjs/winston) | 日志               | 3    |

基础设施：pnpm workspace、Docker Compose、Nginx。

## 系统功能

| 功能     | 说明                                 | 状态 |
| -------- | ------------------------------------ | ---- |
| 首页     | 工作台 / 数据分析面板                | ✅   |
| 权限管理 | 用户 / 角色 / 部门 / 菜单 / 按钮权限 | ✅   |
| 数据权限 | DataScope 行级 + CASL 字段级         | ✅   |
| 客户管理 | 带数据范围与字段脱敏的示例业务       | ✅   |
| 字典     | 字典类型与字典项                     | ✅   |
| 在线用户 | 下线/锁定                            | ✅   |
| 个人信息 | 资料、头像、改密                     | ✅   |
| 文件管理 | 上传 / 列表 / 删除                   | ✅   |
| 系统监控 | 服务状态、在线用户、访问/操作日志    | ✅   |
| 消息通知 | 站内信，待完善                       | ×    |

## 快速开始

```bash
pnpm install
pnpm dev          # 前后端并行：admin :4000 / server :3000
```

环境变量、数据库迁移与 Docker 部署见 [本地开发](./docs/development/local-development.md) 与 [Docker 部署](./docs/deployment/docker.md)。
