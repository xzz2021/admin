import { REQUEST_TIMEOUT } from '@/constants'
import axios from 'axios'
import qs from 'qs'
import type { AxiosInstance } from './types'

export const PATH_URL = import.meta.env.VITE_API_BASE_PATH

/** 业务请求单例；鉴权 / 刷新走独立客户端，避免拦截器互相污染 */
export const axiosInstance: AxiosInstance = axios.create({
  timeout: REQUEST_TIMEOUT,
  baseURL: PATH_URL,
  paramsSerializer: {
    serialize: (params) => qs.stringify(params, { arrayFormat: 'repeat', skipNulls: true })
  }
})
