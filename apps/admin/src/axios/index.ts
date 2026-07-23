import { axiosInstance } from './client'
import { cancelAllRequest, cancelRequest, createPending, removePending } from './pending'
import type { CancellablePromise, RequestConfig } from './types'

/**
 * 对外 HTTP 门面。
 * Token 由请求拦截器注入；此处只组装方法与可选 headers。
 */
const request = <T>(option: AxiosConfig): CancellablePromise<T> => {
  const { url, method, params, data, headers, responseType, withCredentials } = option
  const { controller, requestId } = createPending(url || '')

  const config: RequestConfig = {
    url,
    method,
    params,
    data,
    responseType,
    headers,
    withCredentials,
    signal: controller.signal,
    requestId
  }

  const axiosPromise = axiosInstance.request<T>(config)
  const promise = axiosPromise.then((response) => {
    return responseType === 'blob' ? (response as unknown as T) : response.data
  }) as CancellablePromise<T>

  promise.cancel = () => {
    controller.abort()
    removePending(requestId)
  }

  return promise
}

const http = {
  get: <T = any>(option: AxiosConfig) => {
    return request<IResponse<T>>({ method: 'get', ...option })
  },
  post: <T = any>(option: AxiosConfig) => {
    return request<IResponse<T>>({ method: 'post', ...option })
  },
  delete: <T = any>(option: AxiosConfig) => {
    return request<IResponse<T>>({ method: 'delete', ...option })
  },
  put: <T = any>(option: AxiosConfig) => {
    return request<IResponse<T>>({ method: 'put', ...option })
  },
  cancelRequest,
  cancelAllRequest
}

export default http
export { PATH_URL } from './client'
