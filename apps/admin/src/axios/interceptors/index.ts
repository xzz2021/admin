import type { AxiosInstance } from '../types'
import { onRequest } from './request'
import { onResponse, onResponseError } from './response'

export const setupInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use(onRequest)
  instance.interceptors.response.use(onResponse, onResponseError)
}
