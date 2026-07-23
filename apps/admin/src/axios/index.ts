import service from './service'
import { throttleWrap } from './throttle'

/**
 * 对外 HTTP 门面。
 * Token 由请求拦截器注入；此处只组装方法与可选 headers。
 */
const request = (option: AxiosConfig) => {
  const { url, method, params, data, headers, responseType, withCredentials } = option

  return service.request({
    url,
    method,
    params,
    data,
    responseType,
    headers,
    withCredentials
  })
}

const throttledRequest = throttleWrap(request)

const http = {
  get: <T = any>(option: AxiosConfig) => {
    return throttledRequest({ method: 'get', ...option }) as Promise<IResponse<T>>
  },
  post: <T = any>(option: AxiosConfig) => {
    return throttledRequest({ method: 'post', ...option }) as Promise<IResponse<T>>
  },
  delete: <T = any>(option: AxiosConfig) => {
    return throttledRequest({ method: 'delete', ...option }) as Promise<IResponse<T>>
  },
  put: <T = any>(option: AxiosConfig) => {
    return throttledRequest({ method: 'put', ...option }) as Promise<IResponse<T>>
  },
  cancelRequest: (url: string | string[]) => service.cancelRequest(url),
  cancelAllRequest: () => service.cancelAllRequest()
}

export default http
export { PATH_URL } from './instance'
