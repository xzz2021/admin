# Customer 数据权限 Demo

路径：

- 后端：`apps/server/src/system/customer/`
- 授权核心：`apps/server/src/processor/authorization/`
- 前端：`apps/admin/src/views/Customer/Customer.vue`（菜单 `component` 必须为 `views/Customer/Customer`）
- Demo 种子：`pnpm demo:seed`（只创建菜单、权限和 8 条样例客户，**不创建用户或角色**）

## HTTP API

| 方法   | 路径                   | 权限              |
| ------ | ---------------------- | ----------------- |
| GET    | `/customer/list`       | `customer:view`   |
| GET    | `/customer/detail/:id` | `customer:detail` |
| POST   | `/customer/add`        | `customer:add`    |
| POST   | `/customer/update`     | `customer:update` |
| DELETE | `/customer/delete`     | `customer:delete` |
| GET    | `/customer/export`     | `customer:export` |

附加权限码（`scopeEnabled=false`，不配 DataScope）：

| 权限码                       | 作用                                     |
| ---------------------------- | ---------------------------------------- |
| `customer:assign`            | 变更负责人 / 部门                        |
| `customer:high-value:update` | 更新成交金额 ≥ 100000 的客户             |
| `customer:won:delete`        | 删除 `WON` 客户                          |
| `customer:sensitive:view`    | 列表/详情返回 `internalCost`；可见机密行 |
| `customer:sensitive:update`  | 更新 `internalCost` / `confidential`     |

## 运行时链路

1. `PermissionGuard` 校验功能码，并把 `AuthorizationContext` 挂到请求。
2. `AuthorizationService` 按角色权限解析 DataScope，合并为 Grant。
3. `CustomerPolicy` 生成 Prisma WHERE（范围 + 属性禁止 + 敏感行过滤），Service 再 AND 业务条件。
4. 响应 `capabilities` 为 `['update' \| 'delete' \| 'assign']`；前端只消费该数组和字段是否存在，不复制 CASL 规则。

空 Grant **不是** ALL：必须落到 `id in []`（DENY ALL）。`scopeEnabled` 只控制角色页能否配置范围；`false → true` 后已有 `dataScope=null` 的 RolePermission 视为 scoped DENY ALL。

## 样例客户（`demo:seed`）

| ID                  | 名称              | 状态      | 金额      | 机密 | 用途                 |
| ------------------- | ----------------- | --------- | --------- | ---- | -------------------- |
| `demo_customer_001` | 演示客户·线索小额 | LEAD      | 28000.00  | 否   | 普通可读可改         |
| `demo_customer_002` | 演示客户·线索敏感 | LEAD      | 180000.00 | 是   | 机密 + 高金额        |
| `demo_customer_003` | 演示客户·跟进普通 | FOLLOWING | 99999.99  | 否   | 高金额阈值下界之前   |
| `demo_customer_004` | 演示客户·跟进高额 | FOLLOWING | 100000.00 | 是   | 高金额边界 + 机密    |
| `demo_customer_005` | 演示客户·成交普通 | WON       | 86000.00  | 否   | 成交删除限制         |
| `demo_customer_006` | 演示客户·成交敏感 | WON       | 360000.00 | 是   | 成交 + 高金额 + 机密 |
| `demo_customer_007` | 演示客户·冻结普通 | FROZEN    | 45000.00  | 否   | 冻结禁改删           |
| `demo_customer_008` | 演示客户·冻结敏感 | FROZEN    | 580000.00 | 是   | 冻结 + 高金额 + 机密 |

归属按合格用户所在部门公平轮询。种子不会创建账号，需在角色授权页为已有角色勾选菜单并配置 DataScope。

## 手工权限矩阵

准备至少两个部门（A、B），用户 U_A 属于 A，U_B 属于 B；超管用于对照。每次改角色权限后重新登录或等待缓存版本生效（短暂最终一致）。

### DataScope

| 范围      | 角色配置                                                | 期望                                             |
| --------- | ------------------------------------------------------- | ------------------------------------------------ |
| ALL       | `customer:view` = ALL                                   | 非机密行全可见；有 `sensitive:view` 时含机密行   |
| SELF      | view/detail/update = SELF                               | 只看到 `ownerId = 自己` 的客户；改别人的返回 404 |
| DEPT      | view = DEPT                                             | 只看到本部门；看不到子部门                       |
| DEPT_TREE | view = DEPT_TREE                                        | 本部门 + 子孙部门                                |
| CUSTOM    | view = CUSTOM，勾选部门 A                               | 只看到 A；B 的记录 404                           |
| 空 Grant  | 勾选 `scopeEnabled` 权限但不选范围，或 `dataScope=null` | 列表为空；详情/改删 404；**不得**退化为 ALL      |

新增时未显式传负责人/部门：后端默认当前用户及其部门，且必须落在对应权限 Grant 内。

### 属性禁止

| 场景                | 无例外权限时                   | 有例外权限时                 |
| ------------------- | ------------------------------ | ---------------------------- |
| `FROZEN` 更新/删除  | 行上无 update/delete；接口 404 | 仅超管可改删                 |
| 金额 ≥ 100000 更新  | 无 update 能力；接口 404       | `customer:high-value:update` |
| `WON` 删除          | 无 delete 能力；接口 404       | `customer:won:delete`        |
| 改 owner/department | 无 assign 能力；请求被拒       | `customer:assign` + update   |

### 字段权限

| 权限                  | 列表/详情                             | 编辑                                  |
| --------------------- | ------------------------------------- | ------------------------------------- |
| 无 `sensitive:view`   | 不返回 `internalCost`；机密行整行隐藏 | 前端不渲染成本列                      |
| 有 `sensitive:view`   | 返回 `internalCost`；可见机密行       | —                                     |
| 无 `sensitive:update` | —                                     | 不出现成本/机密字段，请求体也不应带上 |
| 有 `sensitive:update` | —                                     | 可改 `internalCost`、`confidential`   |

### 多角色合并

同一用户两个角色分别授予 `DEPT=A` 与 `CUSTOM=B` 时，可见范围为 **并集**。SELF 与部门范围同样取并。功能码取并；属性例外码（高金额/成交删除/敏感）按是否拥有该码生效。

### 越权与错误码

| 操作                                  | 期望                        |
| ------------------------------------- | --------------------------- |
| 直接请求范围外 `detail/:id`           | 404，文案不泄露是否存在     |
| 无 `customer:add` 调 add              | 403                         |
| 无 `customer:export` 调 export        | 403                         |
| 旧 `version` 更新                     | 409                         |
| 批量删除中任一条不可删                | 整批失败（全有或全无），404 |
| 禁用部门仍被 CUSTOM 勾选后保存        | 角色授权页拦截              |
| 删除仍被 CUSTOM / Customer 引用的部门 | 后端拒绝（409/业务错误）    |

### 缓存失效

| 操作                      | 期望                                               |
| ------------------------- | -------------------------------------------------- |
| 改角色菜单/权限/DataScope | 相关用户授权快照失效；稍后列表范围变化             |
| 调整部门树（增删改父子）  | 组织 generation 递增；`DEPT_TREE` 可见范围随后更新 |
| 删除权限或菜单            | 先落库再失效缓存                                   |

Redis generation 允许短暂最终一致，不必要求同一毫秒内所有节点同时切换。

## 前端清单

- 路由由后端菜单加载，`component = views/Customer/Customer`
- 功能按钮用 `v-hasPermi`（新增/批量删除/导出）
- 行按钮看 `capabilities`，不在前端重写冻结/高金额/成交规则
- `internalCost` 仅当响应存在（或具备 `sensitive:view`）时渲染
- 空列表、403、404、409、分页、CSV 导出
- 不引入独立全局 Store，不引入 Vitest

## 自动化

在 `apps/server` 下已有单测覆盖授权核心、角色 DataScope DTO、Customer Policy/Service、demo-seed 与 security e2e。前端以 `pnpm --filter admin typecheck` / `lint:check` / `build` 为准。

种子幂等与真实 PG 场景见 `apps/server/src/prisma/demo-seed.verification.md`。
