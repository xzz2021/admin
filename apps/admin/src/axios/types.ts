import type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig
} from 'axios'

/** 单次请求可挂载的自定义拦截器 */
export interface RequestInterceptors<T = AxiosResponse> {
  requestInterceptors?: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig
  requestInterceptorsCatch?: (err: unknown) => unknown
  responseInterceptors?: (config: T) => T
  responseInterceptorsCatch?: (err: unknown) => unknown
}

export interface RequestConfig<T = AxiosResponse> extends AxiosRequestConfig {
  interceptors?: RequestInterceptors<T>
  /** 内部：pending 映射键 */
  requestId?: string
  /** 内部：Token 刷新后重试标记 */
  _retry?: boolean
}

export type CancellablePromise<T> = Promise<T> & { cancel: () => void }

export type {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosRequestHeaders,
  AxiosResponse,
  InternalAxiosRequestConfig
}

declare module 'axios' {
  interface AxiosRequestConfig {
    requestId?: string
    _retry?: boolean
  }

  interface InternalAxiosRequestConfig {
    requestId?: string
    _retry?: boolean
  }
}
