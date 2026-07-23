import { forceLogoutApi, getOnlineUserListApi, getUserListApi, unlockApi } from '@/api/system'
import { UserListItem } from '@/api/system/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useSystemStore = defineStore('system', () => {
  const userList = ref<UserListItem[]>([])

  const getUserList = async (params?: any) => {
    const res = await getUserListApi(params)
    const { list = [], total = 0 } = res?.data || {}
    userList.value = list
    return { list, total }
  }

  const getOnlineUserList = async (params?: any) => {
    const res = await getOnlineUserListApi(params)
    return res?.data
  }

  const forceLogout = async (id: number) => {
    const res = await forceLogoutApi(id)
    return res
  }

  const unlock = async (id: number) => {
    const res = await unlockApi(id)
    return res
  }

  return {
    userList,
    getUserList,
    getOnlineUserList,
    forceLogout,
    unlock
  }
})
