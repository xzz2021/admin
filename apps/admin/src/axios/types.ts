import type { AxiosRequestConfig } from 'axios'

export type CancellablePromise<T> = Promise<T> & { cancel: () => void }

export interface RequestConfig extends AxiosRequestConfig {
  requestId?: string
  _retry?: boolean
  /** refresh 因基础设施故障失败（非鉴权失败） */
  _refreshInfraError?: boolean
}

declare module 'axios' {
  interface AxiosRequestConfig {
    requestId?: string
    _retry?: boolean
    _refreshInfraError?: boolean
  }

  interface InternalAxiosRequestConfig {
    requestId?: string
    _retry?: boolean
    _refreshInfraError?: boolean
  }
}
