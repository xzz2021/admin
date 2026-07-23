import { delDepartmentApi, getDepartmentListApi } from '@/api/department'
import { DepartmentItem } from '@/api/department/types'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useDepartmentStore = defineStore('department', () => {
  const departmentList = ref<DepartmentItem[]>([])

  const getDepartmentList = async () => {
    const res = await getDepartmentListApi()
    const { list = [], total = 0 } = res?.data || {}
    departmentList.value = list
    return { list, total }
  }

  const delDepartment = async (id: string) => {
    await delDepartmentApi(id)
  }

  return {
    departmentList,
    getDepartmentList,
    delDepartment
  }
})
