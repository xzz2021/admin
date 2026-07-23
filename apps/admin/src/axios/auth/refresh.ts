import { useUserStoreWithOut } from '@/store/modules/user'
import axios from 'axios'
import { PATH_URL } from '../instance'
import type { RequestConfig } from '../types'
import { applyAuthHeader } from './token'

/** 独立客户端：不挂业务拦截器，避免刷新接口被再次拦截 */
const refreshApi = axios.create({
  baseURL: PATH_URL,
  withCredentials: true
})

type RefreshFn = () => Promise<string>

/**
 * 并发去重（共享 Promise）+ 短窗口缓存。
 * 等价于经典 refresh queue：多请求等待同一次刷新结果。
 */
class TokenRefresher {
  private running: Promise<string> | null = null
  private lastToken: string | null = null
  private lastAt = 0

  constructor(
    private readonly refreshFn: RefreshFn,
    private readonly graceMs = 3000
  ) {}

  tryRefresh(): Promise<string> {
    if (this.running) return this.running

    if (this.lastToken && Date.now() - this.lastAt < this.graceMs) {
      return Promise.resolve(this.lastToken)
    }

    this.running = this.refreshFn()
      .then((token) => {
        this.lastToken = token
        this.lastAt = Date.now()
        return token
      })
      .finally(() => {
        this.running = null
      })

    return this.running
  }
}

const doRefresh: RefreshFn = async () => {
  const res = await refreshApi.post('/auth/refresh')
  const { access_token } = res?.data?.data || {}
  if (!access_token) {
    throw new Error('No accessToken from /auth/refresh')
  }
  return access_token as string
}

function singleton<T>(key: string, create: () => T): T {
  const g = globalThis as Record<string, unknown>
  if (!g[key]) g[key] = create()
  return g[key] as T
}

const refresher = singleton('__token_refresher__', () => new TokenRefresher(doRefresh))

/**
 * AT 过期时静默刷新并返回可重放配置；
 * 无需刷新或刷新失败时返回 null。
 */
export const silentTokenRefresh = async (
  status: number,
  original: RequestConfig | undefined
): Promise<RequestConfig | null> => {
  const isExpired = status === 401 || status === 406
  if (!isExpired || !original || original._retry) {
    return null
  }

  original._retry = true

  try {
    const newToken = await refresher.tryRefresh()
    useUserStoreWithOut().setToken(newToken)
    applyAuthHeader(original as any, newToken)
    return original
  } catch (error: any) {
    if (error?.response?.status === 401) {
      useUserStoreWithOut().logout()
    }
    return null
  }
}
