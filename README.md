> 项目整体结构,目录,架构设计详细文档在根目录[docs](./docs/)下

### 项目说明

> 这是一个前端基于[vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin)二开, 后端使用nestjs + prisma + postgresql, 通过docker构建部署的全栈项目
>
> 权限部分: rbac和casl控制接口和资源是否放行,datascope控制数据过滤
>
> RBAC 决定“你具有什么身份和基础权限”，CASL 把这些权限 + 数据范围 + 当前资源状态组合起来，最终回答“这个用户现在能不能对这条数据做这件事”。

完整流程
controller 里使用 RequiredPermission 装饰器传入需要的code权限码,全局守卫 APP_GUARD 引入 PermissionGuard 用于鉴权, PermissionGuard 调用 AuthorizationContext 查询当前用户所有权限信息, 构建上下文, 并判断受否拥有当前权限, 如果放行则进入 service 同时将 context 传入, service 首先调用 CustomerPolicy 授权适配器用于生产 Prisma WHERE 和 CASL Ability,

CASL 不管行归属；Grant 不管「冻结能不能改」

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
