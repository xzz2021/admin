<script setup lang="tsx">
import { deleteFileApi, getFileListApi, uploadFileApi } from '@/api/file'
import type { FileItem, FileListParams } from '@/api/file/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { UploadBtn } from '@/components/UploadBtn'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { formatToDateTime } from '@/utils/dateUtil'
import { downloadFile, FileUnavailableError, formatFileSize, resolveStaticUrl } from '@/utils/file'
import { ElMessage } from 'element-plus'
import { reactive, ref, unref } from 'vue'
import RenderFile from './components/RenderFile.vue'
const ids = ref<number[]>([])
const allFileList = ref<FileItem[]>([])

const filterFileList = (list: FileItem[], params: FileListParams) => {
  const { name, mimeType, extension } = params
  return list.filter((item) => {
    if (name && !item.name.includes(name)) return false
    if (mimeType && !item.mimeType.includes(mimeType)) return false
    if (extension && !(item.extension || '').includes(extension)) return false
    return true
  })
}

const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const { currentPage, pageSize } = tableState
    const res = await getFileListApi()
    allFileList.value = res.data.list || []
    const filteredList = filterFileList(allFileList.value, unref(searchParams))
    const start = (unref(currentPage) - 1) * unref(pageSize)
    const list = filteredList.slice(start, start + unref(pageSize))
    return { list, total: filteredList.length }
  },
  fetchDelApi: async () => {
    const res = await deleteFileApi(unref(ids))
    if (!res) return false
    const message = typeof res.message === 'string' ? res.message : ''
    if (message.includes('路径不存在')) {
      ElMessage.warning(message)
      return 'silenced'
    }
    return true
  }
})
const { loading, dataList, total, currentPage, pageSize } = tableState
const { getList, getElTableExpose, delList } = tableMethods

const searchParams = ref<FileListParams>({})
const setSearchParams = (params: FileListParams) => {
  searchParams.value = { ...params }
  currentPage.value = 1
  getList()
}

const { t } = useI18n()

const handleDownload = async (row: FileItem) => {
  const fileUrl = resolveStaticUrl(row.url)
  try {
    await downloadFile({ url: fileUrl, fileName: row.name })
  } catch (error) {
    if (error instanceof FileUnavailableError) {
      ElMessage.error(error.message)
      return
    }
    ElMessage.error(t('file.downloadFailed'))
  }
}

const tableColumns = reactive<TableColumn[]>([
  { field: 'select', type: 'selection' },
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index'
  },
  {
    field: 'preview',
    label: t('file.preview'),
    width: 170,
    slots: {
      default: (data: any) => {
        const row = data.row as FileItem
        const { url, extension, name } = row
        return <RenderFile url={resolveStaticUrl(url)} extension={extension || ''} filename={name} />
      }
    }
  },
  {
    field: 'name',
    label: t('file.name'),
    minWidth: 140
  },
  {
    field: 'size',
    label: t('file.size'),
    width: 110,
    formatter: (row: FileItem) => formatFileSize(row.size)
  },
  {
    field: 'mimeType',
    label: t('file.mimeType'),
    minWidth: 140
  },
  {
    field: 'createdAt',
    label: t('file.uploadTime'),
    minWidth: 170,
    formatter: (row: FileItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    minWidth: 160,
    fixed: 'right',
    slots: {
      default: (data: any) => {
        const row = data.row as FileItem
        return (
          <>
            <BaseButton type="primary" onClick={() => handleDownload(row)}>
              {t('formDemo.download')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => delData(row.id)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const delLoading = ref(false)

const delData = async (id?: number) => {
  if (id) {
    ids.value = [id]
  } else {
    const elTableExpose = await getElTableExpose()
    ids.value = elTableExpose?.getSelectionRows().map((v: FileItem) => v.id) || []
  }
  if (ids.value.length === 0) {
    ElMessage.warning(t('file.selectToDelete'))
    return
  }
  delLoading.value = true
  await delList(unref(ids).length).finally(() => {
    delLoading.value = false
  })
}

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: t('file.name'),
    component: 'Input'
  },
  {
    field: 'extension',
    label: t('file.extension'),
    component: 'Input'
  }
])

const startUpload = async (file: File) => {
  await uploadFileApi(file)
  await getList()
  ElMessage.success(t('file.uploadSuccess'))
}
</script>

<template>
  <ContentWrap>
    <Search :schema="searchSchema" @search="setSearchParams" @reset="setSearchParams" />

    <div class="mb-10px flex items-center gap-10px">
      <UploadBtn :upload-api="startUpload" />
      <BaseButton :loading="delLoading" type="danger" @click="delData()">
        {{ t('exampleDemo.batchDel') }}
      </BaseButton>
    </div>

    <Table
      v-model:pageSize="pageSize"
      v-model:currentPage="currentPage"
      align="center"
      headerAlign="center"
      :columns="tableColumns"
      :data="dataList"
      :loading="loading"
      :pagination="{
        total: total
      }"
      @register="tableRegister"
    />
  </ContentWrap>
</template>
