import { useUserStoreWithOut } from '@/store/modules/user'
import type { InternalAxiosRequestConfig } from '../types'

/** 统一写入 Authorization，供请求拦截器与刷新重试共用 */
export const applyAuthHeader = (config: InternalAxiosRequestConfig, token?: string) => {
  const userStore = useUserStoreWithOut()
  const accessToken = token ?? userStore.getToken
  if (!accessToken) return config

  const headerKey = userStore.getTokenKey || 'Authorization'
  config.headers = config.headers ?? {}
  config.headers[headerKey] = `Bearer ${accessToken}`
  return config
}
