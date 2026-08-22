<script setup lang="tsx">
import { createFolderApi, deleteObjectApi, getPublicFileUrlApi, searchOssApi, uploadFileOssApi } from '@/api/oss'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { UploadBtn } from '@/components/UploadBtn'
import { useTable } from '@/hooks/web/useTable'
import { useOssStore } from '@/store/modules/oss'
import { formatToDateTime } from '@/utils/dateUtil'
import { formatFileSize, getFileIcon2 } from '@/utils/file'
import { safeName } from '@/utils/safeName'
import { useClipboard } from '@vueuse/core'
import { ElBreadcrumb, ElBreadcrumbItem, ElButton, ElMessage, ElMessageBox, ElPopover } from 'element-plus'
import { onUnmounted, reactive, ref, unref } from 'vue'
import S3UploadBtn from './components/S3UploadBtn.vue'
import { downloadFile, previewFile } from './components/utils'

const { getOssList } = useOssStore()
const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const params = {
      ...unref(searchParams)
    }
    // 后端返回的array数据  必须有唯一字段? 比如id 不然table组件勾选会变成全选
    return await getOssList(params)
  }
})
const { loading, dataList, total } = tableState
const { getList } = tableMethods

const isSearching = ref(false)
const currentPrefix = ref('')
const searchParams = ref<any>(null)

const setSearchParams = (params: any) => {
  // console.log('xzz2021: setSearchParams -> params', params)
  // 如果params为空
  searchParams.value = params
  currentPrefix.value = params?.prefix || ''
  getList()
}

const searchFile = async (params: { name: string }) => {
  isSearching.value = true
  currentPrefix.value = ''
  const res = await searchOssApi({ searchTerm: params.name })
  const list = res?.data?.list || []
  dataList.value = list
  total.value = list.length
}

const deleteFile = (rawName: string) => {
  ElMessageBox.confirm('确定删除该文件吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(async () => {
    await deleteObjectApi({
      objectName: rawName
    })
    ElMessage.success('删除成功')
    getList()
  })
}

const resetSearch = () => {
  isSearching.value = false
  searchParams.value = null
  currentPrefix.value = ''
  getList()
}

// Popover管理状态
const activePopoverId = ref<string | null>(null)
const popoverRefs = ref<Record<string, any>>({})
const popoverDom = (displayName: string, rawName: string) => {
  const newName = displayName.replace(currentPrefix.value, '')
  const popoverId = `popover-${rawName.replace(/[^a-zA-Z0-9]/g, '-')}`

  return (
    <ElPopover
      ref={(el: any) => {
        if (el) {
          popoverRefs.value[popoverId] = el
        }
      }}
      trigger="contextmenu"
      width="auto"
      v-slots={{
        default: () => (
          <>
            <ElButton type="primary" plain onClick={() => downloadFile(rawName)}>
              下载
            </ElButton>
            <ElButton type="primary" v-show={!rawName.endsWith('/')} plain onClick={() => copyUrl(rawName)}>
              复制url
            </ElButton>
            <ElButton type="danger" plain onClick={() => deleteFile(rawName)}>
              删除
            </ElButton>
          </>
        ),
        reference: () => (
          <div
            class=""
            onContextmenu={() => {
              // 关闭其他打开的Popover
              if (activePopoverId.value && activePopoverId.value !== popoverId) {
                const activePopover = popoverRefs.value[activePopoverId.value]
                if (activePopover && activePopover.hide) {
                  activePopover.hide()
                }
              }
              // 设置当前激活的Popover
              activePopoverId.value = popoverId
            }}
          >
            {newName}
          </div>
        )
      }}
    />
  )
}

const generateDom = (data: any) => {
  const rawName = data?.name || data?.prefix
  const ll = data?.prefix?.split('/')
  const name = data?.name || ll?.[ll?.length - 2]
  const isFolder = data?.prefix
  const { type: fileType, icon: fileIcon } = getFileIcon2(name.split('.').pop() || '')
  const icon = isFolder ? 'flat-color-icons:folder' : fileIcon
  return (
    <>
      {isFolder ? (
        <div
          class="flex items-center gap-10px cursor-pointer"
          onClick={() => {
            setSearchParams({ prefix: data.prefix || '' })
          }}
        >
          <Icon icon={icon}></Icon>
          {popoverDom(name, rawName)}
        </div>
      ) : (
        <div
          class="flex items-center gap-10px cursor-pointer"
          onClick={() => {
            previewFile(rawName, fileType)
          }}
        >
          <Icon icon={icon}></Icon>
          {popoverDom(name, rawName)}
        </div>
      )}
    </>
  )
}

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'selection',
    type: 'selection'
  },
  {
    field: 'name',
    label: '名称',
    slots: {
      default: (data: any) => generateDom(data.row)
    }
  },
  {
    field: 'size',
    label: '大小',
    width: '100px',
    slots: {
      default: (data: any) => {
        return <>{data.row.prefix ? '-' : formatFileSize(data.row.size)}</>
      }
    }
  },
  {
    field: 'lastModified',
    label: '创建时间',
    width: '200px',
    slots: {
      default: (data: any) => {
        return <>{data.row.prefix ? '-' : formatToDateTime(data.row.lastModified)}</>
      }
    }
  }
])

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: '名称',
    component: 'Input'
  }
])

const handleConfirm = (folderName: string) => {
  const newData = {
    folderName: folderName,
    parentPath: currentPrefix.value.replace(/\/$/, '')
  }
  createFolderApi(newData).then((res) => {
    if (res.code === 200) {
      ElMessage.success('创建文件夹成功')
      getList()
    }
  })
}

const open = () => {
  ElMessageBox.prompt('请输入文件夹名称', '创建文件夹', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputPattern: /^[^\/]+$/,
    inputErrorMessage: '请输入正确的文件夹名称'
  })
    .then(({ value }) => {
      handleConfirm(safeName(value))
    })
    .catch(() => {
      ElMessage.info('创建失败')
    })
}

const startUpload = async (file: File) => {
  const fileInfo = {
    // sha256,
    file
  }
  // 1. 上传文件
  await uploadFileOssApi(fileInfo)
  await getList()
  ElMessage.success('上传成功')
}
const { copy } = useClipboard()
const copyUrl = (rawName: string) => {
  getPublicFileUrlApi({ objectName: rawName }).then((res) => {
    const url = res.data.url
    copy(url)
    ElMessage.success('复制url成功')
  })
}

// 组件卸载时清理
onUnmounted(() => {
  activePopoverId.value = null
  popoverRefs.value = {}
})
</script>

<template>
  <ContentWrap>
    <Search :schema="searchSchema" @search="searchFile" @reset="resetSearch" />
    <div class="mb-10px flex items-center justify-between">
      <div class="flex items-center gap-10px">
        <div class="text-14px">当前目录: </div>
        <el-breadcrumb separator="/">
          <el-breadcrumb-item class="cursor-pointer" @click="setSearchParams({ prefix: '' })">
            <div class="hover:bg-gray-100 rounded-md px-5px py-4px"> 根目录 </div>
          </el-breadcrumb-item>
          <el-breadcrumb-item
            v-for="item in currentPrefix.split('/')"
            :key="item"
            class="cursor-pointer"
            @click="setSearchParams({ prefix: currentPrefix.split(item).shift() + item + '/' })"
          >
            <div class="hover:bg-gray-100 rounded-md px-5px py-4px max-w-80px truncate">
              {{ item }}
            </div>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="flex items-center gap-10px">
        <UploadBtn :uploadApi="startUpload" />
        <S3UploadBtn @success="getList" :folderPath="currentPrefix" />
        <BaseButton plain @click="open">创建文件夹</BaseButton>
      </div>
    </div>

    <Table
      :columns="tableColumns"
      :data="dataList"
      :loading="loading"
      :pagination="{
        total: total,
        layout: 'total'
      }"
      :headerCellStyle="() => ({ backgroundColor: '#fafafa' })"
      :border="false"
      @register="tableRegister"
    />
  </ContentWrap>
</template>
