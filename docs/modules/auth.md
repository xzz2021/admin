# Auth 模块

路径：`apps/server/src/system/auth/`

## 能力

| 接口                     | 说明                                        |
| ------------------------ | ------------------------------------------- |
| `POST /auth/register`    | `@Public` 注册                              |
| `POST /auth/login`       | `@Public` + Captcha；单 access token        |
| `POST /auth/rt/login`    | `@Public` + Captcha；双 token（管理端使用） |
| `POST /auth/refresh`     | Refresh cookie `rt` 换取新 access           |
| `POST /auth/logout`      | 撤销会话、清 cookie、移除 presence          |
| `POST /auth/forceLogout` | 强制下线（权限 `user:update`）              |

## 关键实现

| 文件                                     | 职责                                     |
| ---------------------------------------- | ---------------------------------------- |
| `auth.controller.ts` / `auth.service.ts` | HTTP 写 cookie；Service 返回 cookie 描述 |
| `jwt.strategy.ts`                        | Bearer access，`token.secret`            |
| `jwt.refresh.strategy.ts`                | cookie `rt`，`token.refreshSecret`       |
| `token.service.ts`                       | 单 token 会话（Redis）                   |
| `rt.token.service.ts`                    | 双 token；返回 RT cookie 描述            |
| `session-registry.ts`                    | SSO 会话列表 / 黑名单                    |

密码：argon2。登录标识：手机号。

## Guard

- 全局：`RtJwtAuthGuard`（`processor/guard/rt-jwt-auth.ts`）
- 刷新专用：`JwtRefreshAuthGuard`
- 登录验证码：`CaptchaGuard`

`lockout.service.ts` 整文件注释，**未启用**。

## 前端对接

- 登录：`apps/admin/src/api/login` → `auth/rt/login`
- Refresh：`apps/admin/src/axios/auth.ts`
- Token 存 Pinia persist；RT 依赖浏览器 cookie（`withCredentials: true`）

更多见 [authentication.md](../api/authentication.md)。
