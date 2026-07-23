import request from '@/axios'
import { ServerInfoResponse, UserListResponse } from './types'

//  此处后端合并了处理分页查询和 带id过滤的分页查询
export const getUserListApi = (params: any): Promise<IResponse<UserListResponse>> => {
  return request.get({ url: 'user/list', params })
}

export const forceLogoutApi = (id: number): Promise<IResponse> => {
  return request.post({ url: 'auth/forceLogout', data: { id } })
}

export const unlockApi = (id: number): Promise<IResponse> => {
  return request.post({ url: 'auth/unlock', data: { id } })
}

export const getOnlineUserListApi = (params: any): Promise<IResponse<UserListResponse>> => {
  return request.get({ url: 'user/online/list', params })
}

export const getServerInfoApi = (): Promise<IResponse<ServerInfoResponse>> => {
  return request.get({ url: 'utils/serverInfo' })
}
