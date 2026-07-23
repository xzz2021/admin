import { delRoleApi, generateRoleSeedApi, getRoleListApi } from '@/api/role'
import { RoleItem } from '@/api/role/type'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRoleStore = defineStore('role', () => {
  const roleList = ref<RoleItem[]>([])

  const getRoleList = async (params?: any) => {
    const res = await getRoleListApi(params)
    const { list = [], total = 0 } = res.data || {}
    roleList.value = list

    return { list, total }
  }

  const generateSeed = async (data: any) => {
    const res = await generateRoleSeedApi(data)
    if (res) {
      return true
    } else {
      return false
    }
  }

  const delRole = async (id: number) => {
    await delRoleApi(id)
  }

  return {
    roleList,
    getRoleList,
    generateSeed,
    delRole
  }
})
