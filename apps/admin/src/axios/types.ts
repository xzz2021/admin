import type { AxiosRequestConfig } from 'axios'

export type CancellablePromise<T> = Promise<T> & { cancel: () => void }

export interface RequestConfig extends AxiosRequestConfig {
  requestId?: string
  _retry?: boolean
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
