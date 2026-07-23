import request from '@/axios'
import type { FileListParams } from './types'

export const uploadFileApi = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return request.post({
    url: 'staticfile/upload',
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const getFileListApi = (params?: FileListParams) => {
  return request.get({ url: 'staticfile/list', params })
}

export const deleteFileApi = (ids: number[]) => {
  return request.delete({ url: 'staticfile/delete', data: { ids } })
}
