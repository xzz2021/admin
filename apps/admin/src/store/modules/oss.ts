import { OssListItem } from '@/api/oss/types'
import { getOssListApi } from '@/api/oss'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOssStore = defineStore('oss', () => {
  const ossList = ref<OssListItem[]>([])

  const getOssList = async (params?: any) => {
    const res = await getOssListApi(params)
    const { list = [], total = 0 } = res?.data || {}
    ossList.value = list
    return { list, total }
  }

  return {
    ossList,
    getOssList
  }
})
