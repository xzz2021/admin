import type { InternalAxiosRequestConfig } from './types'

type PendingEntry = { controller: AbortController; url: string }

const pendingMap = new Map<string, PendingEntry>()

export const createPending = (url: string) => {
  const controller = new AbortController()
  const requestId = `${url}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  pendingMap.set(requestId, { controller, url })
  return { controller, requestId }
}

export const cleanupPending = (config?: InternalAxiosRequestConfig) => {
  const requestId = config?.requestId
  if (requestId) {
    pendingMap.delete(requestId)
  }
}

/** 为尚未绑定 signal 的请求注册 AbortController（含刷新重试） */
export const attachAbortSignal = (config: InternalAxiosRequestConfig) => {
  if (config.signal) return config

  const { controller, requestId } = createPending(config.url || '')
  config.signal = controller.signal
  config.requestId = requestId
  return config
}

export const cancelRequest = (url: string | string[]) => {
  const urlList = Array.isArray(url) ? url : [url]
  for (const [requestId, pending] of pendingMap) {
    if (urlList.some((u) => pending.url === u || pending.url.includes(u))) {
      pending.controller.abort()
      pendingMap.delete(requestId)
    }
  }
}

export const cancelUniqueRequest = (requestId: string) => {
  const pending = pendingMap.get(requestId)
  pending?.controller.abort()
  pendingMap.delete(requestId)
}

export const cancelAllRequest = () => {
  for (const [, pending] of pendingMap) {
    pending.controller.abort()
  }
  pendingMap.clear()
}

export const removePending = (requestId: string) => {
  pendingMap.delete(requestId)
}
