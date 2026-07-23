import { TRANSFORM_REQUEST_DATA } from '@/constants'
import { objToFormData } from '@/utils'
import qs from 'qs'
import type { InternalAxiosRequestConfig } from './types'

/** 按 Content-Type 转换 body（urlencoded / multipart） */
export const transformRequestData = (config: InternalAxiosRequestConfig) => {
  const contentType = config.headers?.['Content-Type'] || config.headers?.['content-type']

  if (config.method === 'post' && contentType === 'application/x-www-form-urlencoded') {
    config.data = qs.stringify(config.data)
    return config
  }

  if (
    TRANSFORM_REQUEST_DATA &&
    config.method === 'post' &&
    contentType === 'multipart/form-data' &&
    !(config.data instanceof FormData)
  ) {
    config.data = objToFormData(config.data)
  }

  return config
}
