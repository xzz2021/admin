<script setup lang="tsx">
import { delLogApi, getLogListApi } from '@/api/log/index'
import type { LogItem } from '@/api/log/type'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { ElMessage, ElTag } from 'element-plus'
import { reactive, ref, unref } from 'vue'
import Detail from './components/Detail.vue'

const ids = ref<number[]>([])

const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const { currentPage, pageSize } = tableState
    const params = {
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams)
    }
    const res = await getLogListApi(params)
    const { list, total } = res.data
    return { list, total }
  },
  fetchDelApi: async () => {
    const res = await delLogApi(unref(ids))
    return !!res
  }
})
const { loading, dataList, total, currentPage, pageSize } = tableState
const { getList, getElTableExpose, delList } = tableMethods

const searchParams = ref<Recordable>({})
const setSearchParams = (params: Recordable) => {
  const { dateRange, ...rest } = params
  searchParams.value = { ...rest }
  if (dateRange) {
    searchParams.value.dateRange = JSON.stringify([dateRange[0].toISOString(), dateRange[1].toISOString()])
  }
  getList()
}

const { t } = useI18n()

const formatDuration = (duration?: number) => {
  if (duration == null) return '-'
  return `${duration}ms`
}

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'selection',
    type: 'selection'
  },
  {
    field: 'index',
    label: t('tableDemo.index'),
    type: 'index'
  },
  {
    field: 'user.username',
    label: '操作人',
    width: '100px',
    align: 'center',
    formatter: (row: LogItem) => row.user?.username || '-'
  },

  {
    field: 'isSuccess',
    label: '结果',
    width: '90px',
    align: 'center',
    slots: {
      default: (data: any) => {
        const isSuccess = data.row.isSuccess
        return <ElTag type={isSuccess ? 'success' : 'danger'}>{isSuccess ? '成功' : '失败'}</ElTag>
      }
    }
  },
  {
    field: 'responseMsg',
    label: '响应信息',
    minWidth: 140,
    formatter: (row: LogItem) => row.responseMsg || '-'
  },
  {
    field: 'duration',
    label: '响应时长',
    width: '100px',
    align: 'center',
    formatter: (row: LogItem) => formatDuration(row.duration)
  },
  {
    field: 'method',
    label: '方法',
    width: '100px',
    align: 'center'
  },
  {
    field: 'requestUrl',
    label: '路径',
    minWidth: 180
  },
  {
    field: 'ip',
    label: 'IP地址',
    width: '130px'
  },
  {
    field: 'createdAt',
    label: '操作时间',
    minWidth: 170
  },
  {
    field: 'action',
    width: '200px',
    label: t('tableDemo.action'),
    fixed: 'right',
    slots: {
      default: (data: any) => {
        return (
          <>
            <BaseButton type="success" onClick={() => action(data.row, 'detail')}>
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => delData(data.row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const dialogVisible = ref(false)
const dialogTitle = ref('')

const currentRow = ref<LogItem | null>(null)
const actionType = ref('')

const delLoading = ref(false)

const delData = async (row?: LogItem | null) => {
  if (row?.id) {
    ids.value = [row.id]
  } else {
    const elTableExpose = await getElTableExpose()
    ids.value = elTableExpose?.getSelectionRows().map((v: LogItem) => v.id) || []
  }
  if (ids.value.length === 0) {
    ElMessage.warning('请选择要删除的日志')
    return
  }
  delLoading.value = true
  await delList(unref(ids).length).finally(() => {
    delLoading.value = false
  })
}

const action = (row: LogItem, type: string) => {
  dialogTitle.value = t(type === 'edit' ? 'exampleDemo.edit' : 'exampleDemo.detail')
  actionType.value = type
  currentRow.value = row
  dialogVisible.value = true
}

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'requestUrl',
    label: '路径',
    component: 'Input'
  },
  {
    field: 'responseMsg',
    label: '响应信息',
    component: 'Input'
  },
  {
    field: 'method',
    label: '方法',
    component: 'Select',
    componentProps: {
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
        { label: 'PATCH', value: 'PATCH' }
      ]
    }
  },
  {
    field: 'status',
    label: '结果',
    component: 'Select',
    componentProps: {
      options: [
        {
          label: '成功',
          value: 'success'
        },
        {
          label: '失败',
          value: 'fail'
        }
      ]
    }
  },
  {
    field: 'dateRange',
    label: '操作时间',
    component: 'DatePicker',
    componentProps: {
      type: 'datetimerange',
      format: 'YYYY-MM-DD HH:mm:ss',
      disabledDate: (time: Date) => {
        return time.getTime() > Date.now() + 1000 * 60 * 60 * 24
      }
    }
  }
])
</script>

<template>
  <ContentWrap>
    <Search :schema="searchSchema" @search="setSearchParams" @reset="setSearchParams" />

    <div class="mb-10px">
      <BaseButton :loading="delLoading" type="danger" @click="delData()">
        {{ t('exampleDemo.batchDel') }}
      </BaseButton>
    </div>

    <Table
      v-model:pageSize="pageSize"
      v-model:currentPage="currentPage"
      :columns="tableColumns"
      :data="dataList"
      :loading="loading"
      :pagination="{
        total: total
      }"
      @register="tableRegister"
    />
  </ContentWrap>

  <Dialog v-model="dialogVisible" :title="dialogTitle">
    <Detail :current-row="currentRow" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
    </template>
  </Dialog>
</template>
