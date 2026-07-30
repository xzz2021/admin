# 认证与鉴权 API

## 登录方式

### 双 Token（管理端默认）

`POST /auth/rt/login`（Public + CaptchaGuard）

1. 校验验证码（cookie `captchaId` / `captchaText`，服务端 Redis）
2. 校验手机号 + 密码（argon2）
3. 签发 access（响应体）+ refresh（httpOnly cookie `rt`）
4. 会话登记 Redis，受 `SSO_COUNT` 限制

### 单 Token

`POST /auth/login`：仅 access token 会话（`TokenService`）。

### 注册

`POST /auth/register`：Public。

## 验证码

| 方法 | 路径                 | 说明       |
| ---- | -------------------- | ---------- |
| GET  | `/captcha/common`    | 字母图形   |
| GET  | `/captcha/math_expr` | 数学表达式 |

类级 `@Public`，限流约 10 次 / 50s。

## 刷新

`POST /auth/refresh`：Public + `JwtRefreshAuthGuard`

- 读取 cookie `rt`
- 校验签名、黑名单、会话列表
- 轮换 token，返回新 `access_token`

前端：业务 401/406 时自动刷新并重试；并发共用单一 `refreshPromise`。

## 登出 / 强制下线

| 接口                             | 说明                                   |
| -------------------------------- | -------------------------------------- |
| `POST /auth/logout`              | 撤销 access/RT、清 cookie、去 presence |
| `POST /auth/forceLogout`         | 管理员强制下线（`user:update`）        |
| `POST /online/kick` / `kickUser` | 在线模块踢人（`onlineUser:kick`）      |

## 全局鉴权顺序

```
Throttler → RtJwtAuthGuard → PermissionGuard
```

- `@Public()`：跳过 JWT
- 无 `@RequiredPermission`：跳过权限码检查
- 静态路径前缀 `/public/`：JWT Guard 放行
- WebSocket：全局 JWT 返回 false，由各 Gateway 自行验 token

## 密钥与过期（环境变量）

| 变量                         | 用途                            |
| ---------------------------- | ------------------------------- |
| `TOKEN_SECRET`               | Access JWT                      |
| `TOKEN_REFRESH_SECRET`       | Refresh JWT                     |
| `TOKEN_EXPIRES_TIME`         | Access 过期秒数（示例 300）     |
| `TOKEN_REFRESH_EXPIRES_TIME` | Refresh 过期秒数（示例 259200） |
| `SSO_COUNT`                  | 同用户最大会话数                |

详见 [environment.md](../deployment/environment.md)。
