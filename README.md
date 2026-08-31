> 项目整体结构,目录,架构设计详细文档在根目录[docs](./docs/)下

### 项目说明

> 这是一个前端基于[vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin)二开, 后端使用nestjs + prisma + postgresql, 通过docker构建部署的全栈项目
>
> 在线demo: [点击访问](https://admin.xzz2021.top/)
>
> 现已完成 JWT + RBAC + Datascope + CASL 的细颗粒度权限功能, 精确到字段级控制

完整流程

controller 里使用 RequiredPermission 装饰器传入需要的code权限码,全局守卫 APP_GUARD 引入 PermissionGuard 用于鉴权, PermissionGuard 调用 AuthorizationContext 查询当前用户所有权限信息(从数据库读取的原始权限数据结构), 构建上下文, 并判断受否拥有当前权限(rbac), 如果放行则进入 service 同时将 context 传入 policy, service 首先调用 Policy 授权适配器用于生产 Prisma WHERE 和 CASL Ability, queryWhere构建数据库的where筛选条件; 数据库范围条件过滤完, 再靠 project 策略决定每一行的操作权限及敏感数据字段的脱敏和特殊字段的过滤,RBAC 决定“你具有什么身份和基础权限”，CASL 把这些权限 + Datascope + 当前资源状态组合起来，最终回答“这个用户现在能不能对这条数据做这件事”。

## 技术栈

| 框架                                                                 | 说明                  | 版本   |
| -------------------------------------------------------------------- | --------------------- | ------ |
| [Vue](https://staging-cn.vuejs.org/)                                 | Vue 框架              | 3.3.8  |
| [Vite](https://cn.vitejs.dev//)                                      | 开发与构建工具        | 4.5.0  |
| [Element Plus](https://element-plus.org/zh-CN/)                      | Element Plus          | 2.4.2  |
| [TypeScript](https://www.typescriptlang.org/docs/)                   | JavaScript 的超集     | 5.2.2  |
| [pinia](https://pinia.vuejs.org/)                                    | Vue 存储库 替代 vuex5 | 2.1.7  |
| [vueuse](https://vueuse.org/)                                        | 常用工具集            | 10.6.1 |
| [vue-i18n](https://kazupon.github.io/vue-i18n/zh/introduction.html/) | 国际化                | 9.6.5  |
| [vue-router](https://router.vuejs.org/)                              | Vue 路由              | 4.2.5  |
| [unocss](https://uno.antfu.me/)                                      | 原子 css              | 0.57.4 |
| [wangeditor](https://www.wangeditor.com/)                            | 富文本编辑器          | 5.1.23 |

### 系统功能实现

| 功能列表 | 功能描述 | 是否完成 |
| -------- | -------- | -------- |
| 测试     | 2424     | ✅       |
