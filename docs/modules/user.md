# User 模块

路径：`apps/server/src/system/user/`

## HTTP API

| 方法   | 路径                       | 权限                 |
| ------ | -------------------------- | -------------------- |
| GET    | `/user/list`               | `user:view`          |
| GET    | `/user/listByDepartmentId` | `user:view`          |
| GET    | `/user/detailInfo`         | 当前用户（登录即可） |
| POST   | `/user/add`                | `user:add`           |
| POST   | `/user/update`             | `user:update`        |
| DELETE | `/user/delete`             | `user:delete`        |
| POST   | `/user/updatePersonalInfo` | 本人                 |
| POST   | `/user/updatePassword`     | 本人                 |
| POST   | `/user/resetPassword`      | `user:update`        |
| POST   | `/user/upload/avatar`      | 登录用户             |

另有 `POST /auth/forceLogout`（权限 `user:update`）与在线踢人接口配合会话撤销。

## 数据

Prisma `User`：username、password（哈希）、nickname、email、phone、avatar、enabled、department、roles、sessions、日志与消息关联。

## 前端

- 页面：`apps/admin/src/views/Authorization/User/`
- API：`apps/admin/src/api/user/`
- 个人中心：`views/Personal/PersonalCenter/`
- Store：`store/modules/user.ts`、`system.ts`（系统用户列表侧）

头像上传亦可走 `staticfile/upload/avatar`。
