import type { AxiosRequestConfig } from 'axios'

const normalize = (data: unknown): string => {
  if (data == null) return ''
  if (typeof data !== 'object') return String(data)

  try {
    const obj = data as Record<string, unknown>
    const sorted = Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = obj[key]
        return acc
      }, {})
    return JSON.stringify(sorted)
  } catch {
    return String(data)
  }
}

const getRequestKey = (config: AxiosRequestConfig): string => {
  const { method = 'get', url = '', data, params } = config
  return `${method}::${url}::${normalize(params)}::${normalize(data)}`
}

const requestCache = new Map<string, number>()
const THROTTLE_GAP = 1000

const pruneCache = (now: number) => {
  if (requestCache.size < 200) return
  for (const [key, time] of requestCache) {
    if (now - time > THROTTLE_GAP) {
      requestCache.delete(key)
    }
  }
}

/** 按请求指纹节流；直接返回原 Promise，保留 cancel */
export const throttleWrap = <T extends (...args: any[]) => any>(fn: T, delay: number = THROTTLE_GAP): T => {
  return ((...args: any[]) => {
    const key = getRequestKey(args[0] || {})
    const now = Date.now()
    const lastTime = requestCache.get(key)

    if (lastTime && now - lastTime < delay) {
      return Promise.reject(new Error('请求被节流，请稍后再试'))
    }

    requestCache.set(key, now)
    pruneCache(now)
    return fn(...args)
  }) as T
}
