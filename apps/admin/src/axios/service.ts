import { axiosInstance } from './instance'
import { setupInterceptors } from './interceptors'
import { cancelAllRequest, cancelRequest, cancelUniqueRequest, createPending, removePending } from './pending'
import type { CancellablePromise, InternalAxiosRequestConfig, RequestConfig } from './types'

setupInterceptors(axiosInstance)

const service = {
  request: <T = unknown>(config: RequestConfig): CancellablePromise<T> => {
    if (config.interceptors?.requestInterceptors) {
      config = config.interceptors.requestInterceptors(config as InternalAxiosRequestConfig)
    }

    // 在 axios mergeConfig 前绑定，保证 promise.cancel 能拿到同一 controller
    const { controller, requestId } = createPending(config.url || '')
    config.signal = controller.signal
    config.requestId = requestId

    const promise = axiosInstance.request(config) as CancellablePromise<T>
    promise.cancel = () => {
      controller.abort()
      removePending(requestId)
    }

    return promise
  },
  cancelRequest,
  cancelUniqueRequest,
  cancelAllRequest
}

export default service
