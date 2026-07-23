import { SUCCESS_CODE } from '@/constants'
import axios, { AxiosError } from 'axios'
import { silentTokenRefresh } from '../auth/refresh'
import { getAxiosErrorMessage, showAxiosError } from '../error'
import { axiosInstance } from '../instance'
import { cleanupPending } from '../pending'
import type { AxiosResponse, RequestConfig } from '../types'

/** 成功：业务码校验，解包 IResponse */
export const onResponse = (response: AxiosResponse) => {
  cleanupPending(response.config)

  if (response.config?.responseType === 'blob') {
    return response
  }

  if (response.data?.code === SUCCESS_CODE) {
    return response.data
  }

  const msg = response.data?.message || '请求失败'
  const text = typeof msg === 'string' ? msg : String(msg)
  showAxiosError(text)
  return Promise.reject(new Error(text))
}

/** 失败：Token 刷新重试 → 取消忽略 → 统一错误提示 */
export const onResponseError = async (error: AxiosError<any>) => {
  cleanupPending(error.config)

  const status = error.response?.status || 0
  const retryConfig = await silentTokenRefresh(status, error.config as RequestConfig | undefined)
  if (retryConfig) {
    delete retryConfig.signal
    delete retryConfig.requestId
    return axiosInstance.request(retryConfig)
  }

  if (axios.isCancel(error) || error.code === 'ERR_CANCELED') {
    return Promise.reject(error)
  }

  showAxiosError(getAxiosErrorMessage(error))
  return Promise.reject(error)
}
