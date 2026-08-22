import request, { type DownloadResponse } from '@/axios'
import { OssListResponse } from './types'

//  此处后端合并了处理分页查询和 带id过滤的分页查询
export const getOssListApi = (params: any): Promise<IResponse<OssListResponse>> => {
  return request.get({ url: 'minio/publicBucket', params })
}

export const getPublicFileUrlApi = (params: { objectName: string }): Promise<IResponse<{ url: string }>> => {
  return request.get({ url: 'minio/publicFileUrl', params })
}

// 创建文件夹
export const createFolderApi = (data: { folderName: string; parentPath?: string }): Promise<IResponse<any>> => {
  return request.post({ url: 'minio/createFolder', data })
}

// 删除文件夹
export const deleteFolderApi = (params: any): Promise<IResponse<any>> => {
  return request.delete({ url: 'minio/publicBucket', data: params })
}

interface UploadFileParams {
  file: File
  // sha256: string
  // remark?: string
  [key: string]: any
}
export const uploadFileOssApi = (data: UploadFileParams) => {
  return request.post({
    url: 'minio/upload',
    data,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

// 删除文件
export const deleteObjectApi = (params: { objectName: string }): Promise<IResponse<any>> => {
  return request.delete({ url: 'minio/delete', params })
}

export const downloadObjectApi = (params: { objectName: string }): Promise<DownloadResponse> => {
  return request.download({
    url: 'minio/download',
    params
  })
}

export const downloadFolderApi = (params: { folderPath: string }): Promise<DownloadResponse> => {
  return request.download({
    url: 'minio/folder/download',
    params
  })
}

// 搜索
export const searchOssApi = (params: { searchTerm: string }): Promise<IResponse<any>> => {
  return request.get({ url: 'minio/search', params })
}

// 获取文件URL
export const getFileUrlApi = (params: {
  objectName: string
}): Promise<IResponse<{ url: string; objectName: string; operation: string; expiry: number }>> => {
  return request.get({ url: 'minio/presigned', params })
}
