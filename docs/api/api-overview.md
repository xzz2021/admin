# API 总览

## 约定

- Nest **无**全局前缀；开发/生产通过网关的 `/api` 前缀转发并剥离
- 统一响应信封（`ResOp`）：`{ code, data, message, timestamp }`
  - 成功：HTTP 200 + `code === 200`，由 `TransformInterceptor` 包装
  - 失败：HTTP status = `code`，由 `AllExceptionsFilter` 写出同一信封（`data: null`）
- 成功业务码前端约定为 `200`
- 鉴权：`Authorization: Bearer <access_token>`；刷新依赖 cookie `rt`
- 校验：Zod（nestjs-zod）；限流默认 100 次 / 60s（验证码更严）

## 模块路由表

| 前缀          | 模块       | 主要能力                                                          |
| ------------- | ---------- | ----------------------------------------------------------------- |
| `/`           | App        | `GET /`、`GET /health`                                            |
| `/auth`       | Auth       | 注册、登录、刷新、登出、强制下线                                  |
| `/captcha`    | Captcha    | 图形/数学验证码（Public）                                         |
| `/user`       | User       | 用户 CRUD、个人信息、密码、头像                                   |
| `/role`       | Role       | 角色、分配、当前菜单                                              |
| `/menu`       | Menu       | 菜单 CRUD、排序                                                   |
| `/permission` | Permission | 权限 CRUD                                                         |
| `/department` | Department | 部门树 + seed 导出                                                |
| `/dictionary` | Dictionary | 字典类型/项 + seed 导出                                           |
| `/staticfile` | Staticfile | 上传、列表、删除、流式示例                                        |
| `/monitor`    | Monitor    | 快照                                                              |
| `/online`     | Online     | 在线列表、踢人                                                    |
| `/message`    | Message    | 收件箱（list/已读/删除）；管理端发送站内信/系统通知（告警仅内部） |
| `/log`        | Logger     | 操作日志查询/删除                                                 |

## WebSocket

| 路径          | 用途          |
| ------------- | ------------- |
| `/online/ws`  | 在线 presence |
| `/monitor/ws` | 监控推送      |
| `/message/ws` | 消息推送      |

经 admin Nginx 时对外为 `/api/online/ws` 等（去掉 `/api` 后到 server）。

## Swagger

- 环境变量 `SWAGGER=true` 时启用，Basic Auth（`SWAGGER_USERNAME` / `SWAGGER_PASSWORD`）
- 生产模板默认 `SWAGGER=false`

## 前端未对接或 mock

- 管理端部分 dashboard/table API 为本地 mock
- 前端存在短信/微信登录相关 API 声明，登录表单当前拦截未走通真实后端流程
- Schema 中 Notice **无**对应 Controller；AuditLog 列表见 `GET /log/getAuditLogList`
