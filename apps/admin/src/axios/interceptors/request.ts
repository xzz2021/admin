import { CONTENT_TYPE } from '@/constants'
import { applyAuthHeader } from '../auth/token'
import { attachAbortSignal } from '../pending'
import { transformRequestData } from '../transform'
import type { InternalAxiosRequestConfig } from '../types'

/** 请求拦截：AbortSignal → Auth → Body 转换 */
export const onRequest = (config: InternalAxiosRequestConfig) => {
  attachAbortSignal(config)

  config.headers = config.headers ?? {}
  if (!config.headers['Content-Type'] && !config.headers['content-type']) {
    config.headers['Content-Type'] = CONTENT_TYPE
  }

  applyAuthHeader(config)
  return transformRequestData(config)
}
