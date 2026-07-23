# RBAC权限文档 Prompt

生成 permission.md。

分析当前RBAC实现。

说明：

## 权限模型

User ↓ Role ↓ Permission

## 登录流程

账号密码验证 ↓ JWT生成 ↓ Token返回 ↓ 前端保存

## 请求鉴权流程

Request ↓ JWT Guard ↓ 用户解析 ↓ 权限检查 ↓ Controller

说明：

-   数据模型
-   Guard
-   Decorator
-   Metadata
-   权限编码
-   新增角色流程
-   新增菜单流程
-   新增接口权限流程
