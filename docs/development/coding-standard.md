# 编码规范

结合仓库实践与 `.cursor/rules/coding-standard.mdc`。

## TypeScript

- 开启 strict；明确类型；避免 `any`
- 优先 `interface` / `type`；避免巨型函数与重复逻辑

## NestJS

| 层                 | 职责                                      |
| ------------------ | ----------------------------------------- |
| Controller         | HTTP、装饰器（权限/Public）、调用 Service |
| Service            | 业务逻辑                                  |
| PgService / Prisma | 数据访问                                  |
| DTO                | Zod / 生成 DTO 校验                       |
| Guard              | 认证与权限                                |

必须：依赖注入、统一异常过滤、统一响应包装。

## Prisma

- Schema 字段与注释清晰；复杂写操作使用 transaction
- 注意 N+1；列表查询控制 select/include
- 迁移走 `migrate`，生产用 `migrate deploy`

## Redis

- Key 语义清晰并设 TTL（会话、验证码、RBAC 缓存等）
- 缓存故障时权限 Guard 应返回服务不可用，而非伪装鉴权失败（见现有实现）

## 前端

- 业务 API 放 `src/api/<domain>`
- 状态放 Pinia modules；持久化仅必要字段
- 权限按钮统一走指令/组件，与后端 permission code 对齐
- 遵循现有 Element Plus + 布局体系，避免另起一套 UI 风格

## Git / CI

- Commit 信息遵循 Conventional Commits（commitlint）
- PR / push 触发 `pnpm check`
