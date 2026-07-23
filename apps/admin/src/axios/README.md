# Axios 封装说明

本目录是 Admin 前端的统一 HTTP 层，基于 Axios 单例 + 模块化拦截器，覆盖鉴权注入、Token 静默刷新、请求取消、错误提示与节流。

业务侧只应通过门面调用：

```ts
import request from '@/axios'

const res = await request.get<UserItem[]>({ url: '/user/list', params: { page: 1 } })
// res: IResponse<UserItem[]>
```

---

## 1. 目录结构

```
axios/
├── index.ts                 # 对外门面：get/post/put/delete/cancel*
├── service.ts               # 请求编排 + 可取消 Promise
├── instance.ts              # axios.create 单例与基础配置
├── types.ts                 # 类型定义 + axios 模块增强
├── pending.ts               # AbortController 注册 / 取消 / 清理
├── error.ts                 # 错误文案映射 + Toast
├── throttle.ts              # 请求指纹节流
├── transform.ts             # Body 按 Content-Type 转换
├── auth/
│   ├── token.ts             # Authorization 写入
│   └── refresh.ts           # 并发去重刷新 + 重试配置
└── interceptors/
    ├── index.ts             # 统一挂载拦截器
    ├── request.ts           # 请求链路：signal → auth → transform
    └── response.ts          # 响应链路：业务码 / 刷新重试 / 错误
```

| 文件 | 职责 | 不做什么 |
|------|------|----------|
| `index.ts` | HTTP 方法门面、节流包装 | 不写 Token、不处理业务码 |
| `service.ts` | 发起请求、绑定 cancel | 不关心 UI 提示 |
| `instance.ts` | 创建实例、timeout、paramsSerializer | 不挂业务逻辑 |
| `auth/*` | Token 读写与刷新 | 不弹 Toast |
| `interceptors/*` | 横切关注点编排 | 不对外暴露 |
| `pending.ts` | 取消与 pending 生命周期 | 不发起网络请求 |
| `error.ts` | 错误信息与提示 | 不决定是否重试 |

---

## 2. 设计原则（最佳实践对齐）

### 2.1 使用 `axios.create`，不用全局 `axios`

- 业务请求与 Token 刷新使用**不同实例**。
- 刷新客户端不挂业务拦截器，避免 `/auth/refresh` 再次触发 401 刷新逻辑形成死循环。
- 不向 `axios.defaults.headers.common` 写 Authorization，防止污染其他域名请求。

### 2.2 拦截器模块化

- 请求拦截器职责：AbortSignal、默认 Content-Type、Auth、Body 转换。
- 响应拦截器职责：业务码解包、Token 刷新重试、统一错误提示。
- **单一响应拦截器**：避免「刷新重试后再包一层 `{ data }`」的脆弱写法。

### 2.3 Auth 放在请求拦截器

- Token 注入集中在 `auth/token.ts` + `interceptors/request.ts`。
- 门面层只组装 `url/method/params/data/headers`，不重复拼 Bearer。

### 2.4 取消使用 AbortController

- Axios 已废弃 `CancelToken`，统一使用 `signal`。
- pending 表在成功/失败/取消后及时清理，避免泄漏。

### 2.5 类型增强

- 通过 `declare module 'axios'` 扩展 `_retry`、`requestId`，保证拦截器内类型安全。

### 2.6 参数序列化

- 使用 `paramsSerializer`（`qs`）处理 GET 参数，替代手写 query 拼接。

---

## 3. 请求完整链路

```mermaid
sequenceDiagram
  participant API as api/*.ts
  participant Index as index.ts
  participant Throttle as throttle.ts
  participant Service as service.ts
  participant Req as request interceptor
  participant HTTP as Backend
  participant Res as response interceptor

  API->>Index: get/post/put/delete
  Index->>Throttle: 指纹节流
  Throttle->>Service: service.request(config)
  Service->>Service: createPending + signal
  Service->>Req: axiosInstance.request
  Req->>Req: attachAbort / auth / transform
  Req->>HTTP: 真实 HTTP
  HTTP-->>Res: 响应
  alt code === SUCCESS_CODE
    Res-->>API: IResponse&lt;T&gt;
  else HTTP 401/406
    Res->>Res: silentTokenRefresh
    Res->>HTTP: 带新 Token 重试
    HTTP-->>API: IResponse&lt;T&gt;
  else 其他错误
    Res->>Res: showAxiosError
    Res-->>API: reject
  end
```

---

## 4. 核心功能与实现原理

### 4.1 对外门面（`index.ts`）

**优点**

- API 模块写法统一：`request.get/post/put/delete`。
- 对外稳定，内部重构不影响 `src/api/**`。

**原理**

1. 组装 `AxiosConfig` 交给 `service.request`。
2. 通过 `throttleWrap` **只包装一次**，避免每次调用新建闭包。
3. 返回类型约定为 `Promise<IResponse<T>>`（响应拦截器已解包）。

```ts
request.post<SmsLoginRes>({ url: '/auth/login', data })
```

---

### 4.2 实例与基础配置（`instance.ts`）

**优点**

- 超时、baseURL、序列化集中配置，一处修改全局生效。
- `skipNulls` 避免把 `null/undefined` 参数传到后端。

**原理**

```ts
axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: PATH_URL, // import.meta.env.VITE_API_BASE_PATH
  paramsSerializer: {
    serialize: (params) => qs.stringify(params, { arrayFormat: 'repeat', skipNulls: true })
  }
})
```

---

### 4.3 请求拦截（`interceptors/request.ts`）

执行顺序：

1. **AbortSignal**：若尚未绑定则注册 pending。
2. **Content-Type**：缺省时补 `application/json`。
3. **Auth**：从 Pinia userStore 读取 Token，写入 `Bearer <token>`。
4. **Transform**：按 Content-Type 转换 body（urlencoded / multipart）。

**优点**

- 横切逻辑与业务 API 解耦。
- 刷新重试走同一套 Auth 写入，Token 格式一致。

---

### 4.4 响应拦截（`interceptors/response.ts`）

#### 成功分支

1. `cleanupPending` 释放 AbortController 引用。
2. `blob` 直接返回原始 `AxiosResponse`（下载场景）。
3. `response.data.code === SUCCESS_CODE` 时返回 `response.data`（即 `IResponse`）。
4. 业务失败：Toast + `Promise.reject`。

#### 失败分支

1. 清理 pending。
2. 尝试 `silentTokenRefresh`；成功则清除旧 `signal/requestId` 后重放请求。
3. 取消错误（`ERR_CANCELED`）静默 reject，不弹 Toast。
4. 其余错误：映射文案并 Toast，再 reject。

**优点**

- 单一拦截器处理成功与失败，刷新重试无需二次包装响应结构。
- 取消与业务错误分流，避免误报「网络异常」。

---

### 4.5 Token 静默刷新（`auth/refresh.ts`）

**解决的问题**

多个并行请求同时 401 时，若各自去刷 Token：

- 刷新接口被打爆；
- 若 RT 单次有效，后到的刷新会失败并误登出。

**实现原理（共享 Promise ≈ Refresh Queue）**

```
请求 A 401 ──► tryRefresh() ──► 发起 /auth/refresh
请求 B 401 ──► tryRefresh() ──► 复用同一个 running Promise
请求 C 401 ──► tryRefresh() ──► 同上
                │
                ▼
         拿到 newToken
         更新 userStore
         各请求用新 Token 重放
```

关键点：

| 机制 | 作用 |
|------|------|
| `running` Promise | 并发去重，多请求等待同一次刷新 |
| `graceMs` 短窗口缓存 | 极短时间内的追击 401 直接复用新 Token |
| `_retry` 标记 | 防止刷新后重试再次 401 形成死循环 |
| 独立 `refreshApi` | `withCredentials: true` 携带 HttpOnly RT Cookie |
| `singleton` | 开发态 HMR 避免重复 `new TokenRefresher` |

触发条件：HTTP `401` 或 `406`，且原请求未标记 `_retry`。

刷新失败且响应仍为 401：调用 `userStore.logout()`。

---

### 4.6 请求取消（`pending.ts` + `service.ts`）

**优点**

- 路由切换 / 卸载组件时可中断无意义请求。
- 按 url、按 requestId、全部取消三种粒度。

**原理**

1. `createPending(url)` → `AbortController` + `requestId` 写入 `pendingMap`。
2. `config.signal = controller.signal` 交给 Axios。
3. 响应结束或 abort 后从 Map 删除。
4. `service.request` 在 `mergeConfig` **之前**绑定 controller，并把 `cancel` 挂到返回的 Promise 上：

```ts
const p = request.get({ url: '/user/list' })
// 若底层走 service.request 且保留 cancel：
;(p as any).cancel?.()
```

对外便捷 API：

```ts
request.cancelRequest('/user/list')
request.cancelAllRequest()
```

> 注意：`cancelRequest` 按 `pending.url` 精确或包含匹配；刷新重试会重新注册新的 pending。

---

### 4.7 错误处理（`error.ts`）

**优点**

- 文案与 Toast 单一来源，避免 service / interceptor 重复实现。
- 优先展示后端 `message`（string 或 string[]）。

**映射优先级**

1. 服务端 `message`
2. `ECONNABORTED` → 超时提示
3. `ERR_NETWORK` / 无 response → 连不上后端
4. 按 HTTP status（503/500/404/403/401）回落默认文案

---

### 4.8 请求节流（`throttle.ts`）

**优点**

- 防止按钮连点导致重复提交。
- 直接返回原 Promise，**保留** `cancel` 等附加方法。

**原理**

1. 用 `method + url + 规范化 params/data` 生成指纹。
2. 同一指纹在 `THROTTLE_GAP`（默认 1s）内再次发起 → `reject('请求被节流…')`。
3. 缓存过大时惰性清理，不使用常驻 `setInterval`。

---

### 4.9 Body 转换（`transform.ts`）

| Content-Type | 行为 |
|--------------|------|
| `application/x-www-form-urlencoded` | `qs.stringify` |
| `multipart/form-data` 且 data 非 FormData | `objToFormData` |
| 已是 `FormData` | 不处理 |

---

## 5. 类型约定

### 5.1 业务响应

全局类型（`types/global.d.ts`）：

```ts
interface IResponse<T = any> {
  code: number
  data: T
  message: string
}
```

成功时拦截器返回的是 **整个 `IResponse`**，因此 API 层通常：

```ts
const { data } = await request.get<UserItem[]>({ url: '/user/list' })
```

### 5.2 模块增强字段

| 字段 | 含义 |
|------|------|
| `requestId` | pending Map 的键 |
| `_retry` | 是否已因 Token 刷新重试过 |

---

## 6. 使用示例

### 6.1 常规 CRUD

```ts
import request from '@/axios'

export const getUserListApi = (params?: ListParams) => {
  return request.get<{ list: UserItem[]; total: number }>({
    url: '/user/list',
    params
  })
}

export const updateUserApi = (data: UpdateUserPayload) => {
  return request.put({ url: '/user/update', data })
}
```

### 6.2 文件上传

```ts
return request.post<{ filePath: string }>({
  url: '/user/avatar',
  data: formData,
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

### 6.3 文件下载（blob）

```ts
return request.get({
  url: '/file/download',
  responseType: 'blob'
})
```

此时响应拦截器不走业务码解包，返回完整 `AxiosResponse`。

### 6.4 取消请求

```ts
import request from '@/axios'

// 离开页面时
onBeforeUnmount(() => {
  request.cancelRequest('/dashboard/analysis')
  // 或
  request.cancelAllRequest()
})
```

---

## 7. 扩展指南

### 7.1 新增请求侧逻辑

在 `interceptors/request.ts` 的 `onRequest` 中按顺序追加，或抽到独立函数再组合。保持 **单一职责**，避免把 UI 逻辑塞进 transform。

### 7.2 新增错误码文案

只改 `error.ts` 的 `getAxiosErrorMessage`，不要在业务页面零散 `ElMessage`。

### 7.3 调整刷新策略

只改 `auth/refresh.ts`：

- 过期状态码
- `graceMs`
- 刷新接口路径与字段名（当前为 `access_token`）

### 7.4 关闭某类请求的节流

当前为全局节流。若需白名单，可在 `throttle.ts` 对特定 `url` 直接 `return fn(...args)`。

---

## 8. 常见问题

**Q: 为什么刷新要用单独的 axios 实例？**  
A: 业务实例的响应拦截器会处理 401。若刷新请求也走同一套逻辑，刷新失败或再 401 时可能递归刷新。

**Q: 为什么 `service.request` 要在拦截器之前创建 AbortController？**  
A: Axios 内部 `mergeConfig` 会生成新 config。若只在拦截器里写 `requestId`，外层 Promise 的 `cancel` 可能拿不到同一个 controller。先绑定再 request，保证闭包引用正确。

**Q: 刷新成功后为什么要 `delete signal/requestId`？**  
A: 旧 signal 可能已结束；清掉后由请求拦截器为重试请求重新注册 pending，避免沿用失效 signal。

**Q: 节流 reject 会不会弹「网络异常」？**  
A: 节流在进入 Axios 之前就 reject，不经过响应错误拦截器，因此不会走 `getAxiosErrorMessage`。调用方需自行 catch。

---

## 9. 相关常量

| 常量 | 位置 | 含义 |
|------|------|------|
| `SUCCESS_CODE` | `@/constants` | 业务成功码（默认 200） |
| `CONTENT_TYPE` | `@/constants` | 默认 `application/json` |
| `REQUEST_TIMEOUT` | `@/constants` | 超时毫秒数 |
| `TRANSFORM_REQUEST_DATA` | `@/constants` | 是否自动转 FormData |
| `VITE_API_BASE_PATH` | `.env.*` | `baseURL` |

---

## 10. 维护约定

1. **不要**在 `.vue` 里直接 `import axios from 'axios'` 打业务接口。
2. **不要**在多个文件重复 `ElMessage` 错误提示；统一走 `error.ts`。
3. 改拦截器行为前，先确认是否影响 Token 刷新与 blob 下载两条特殊路径。
4. 对外导出保持兼容：默认导出 `http` 门面，具名导出 `PATH_URL`。
