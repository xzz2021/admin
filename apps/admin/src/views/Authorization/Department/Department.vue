<script setup lang="tsx">
import { addDepartmentApi, delDepartmentApi, editDepartmentApi, getDepartmentListApi } from '@/api/department'
import type { DepartmentItem } from '@/api/department/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { reactive, ref } from 'vue'
import Write from './components/Write.vue'
import { filterDepartmentTree } from './utils/departmentTree'

const { t } = useI18n()

/** 完整部门树缓存，搜索只在前端过滤 */
const sourceList = ref<DepartmentItem[]>([])
const searchParams = ref<Recordable>({})

const applyFilter = (list: DepartmentItem[] = sourceList.value) =>
  filterDepartmentTree(list, {
    name: searchParams.value.name,
    enabled: searchParams.value.enabled
  })

const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const res = await getDepartmentListApi()
    sourceList.value = res.data.list || []
    const list = applyFilter(sourceList.value)
    return {
      list,
      total: list.length
    }
  }
})

const { dataList, loading } = tableState
const { getList } = tableMethods

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('tableDemo.index'),
    type: 'index'
  },
  {
    field: 'name',
    label: t('userDemo.departmentName')
  },
  // {
  //   field: 'sort',
  //   label: '排序',
  //   width: 80
  // },
  {
    field: 'enabled',
    label: t('menu.status'),
    width: 100,
    slots: {
      default: (data: any) => (
        <ElTag type={data.row.enabled ? 'success' : 'danger'}>
          {data.row.enabled ? t('userDemo.enable') : t('userDemo.disable')}
        </ElTag>
      )
    }
  },
  {
    field: 'description',
    label: t('userDemo.remark'),
    minWidth: 160,
    showOverflowTooltip: true
  },
  {
    field: 'createdAt',
    label: t('tableDemo.displayTime'),
    width: 180
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 180,
    slots: {
      default: (data: any) => {
        const row = data.row as DepartmentItem
        return (
          <>
            <BaseButton type="primary" onClick={() => openDialog(row)}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => handleDelete(row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'name',
    label: t('userDemo.departmentName'),
    component: 'Input'
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    component: 'Select',
    componentProps: {
      options: [
        { label: t('userDemo.enable'), value: true },
        { label: t('userDemo.disable'), value: false }
      ]
    }
  }
])

const setSearchParams = (data: Recordable) => {
  searchParams.value = data
  dataList.value = applyFilter()
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const currentRow = ref<DepartmentItem | null>(null)
const writeRef = ref<InstanceType<typeof Write>>()
const saveLoading = ref(false)

const openDialog = (row?: DepartmentItem) => {
  dialogTitle.value = row ? t('exampleDemo.edit') : t('exampleDemo.add')
  currentRow.value = row ?? null
  dialogVisible.value = true
}

const handleDelete = async (row: DepartmentItem) => {
  if (row.children?.length) {
    ElMessage.warning('该部门存在子部门，请先删除子部门')
    return
  }

  try {
    await ElMessageBox.confirm(`确认删除部门「${row.name}」？`, '提示', { type: 'warning' })
    await delDepartmentApi(row.id)
    ElMessage.success('删除成功')
    getList()
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

const handleSave = async () => {
  const formData = await writeRef.value?.submit()
  if (!formData) return

  saveLoading.value = true
  try {
    const payload = {
      name: formData.name,
      parentId: formData.parentId || null,
      enabled: formData.enabled ?? true,
      description: formData.description || undefined
    }

    if (formData.id) {
      await editDepartmentApi({ ...payload, id: formData.id })
      ElMessage.success('更新成功')
    } else {
      await addDepartmentApi(payload)
      ElMessage.success('新增成功')
    }

    dialogVisible.value = false
    getList()
  } catch (error) {
    console.error(error)
    ElMessage.error('保存失败')
  } finally {
    saveLoading.value = false
  }
}
</script>

<template>
  <ContentWrap>
    <div class="mb-12px flex flex-wrap items-end gap-12px">
      <div class="min-w-0 flex-1">
        <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
      </div>
      <BaseButton type="success" class="mb-[18px] flex-shrink-0" @click="openDialog()">
        {{ t('exampleDemo.add') }}
      </BaseButton>
    </div>

    <Table
      :columns="tableColumns"
      default-expand-all
      node-key="id"
      :data="dataList"
      :loading="loading"
      @register="tableRegister"
    />
  </ContentWrap>

  <Dialog v-model="dialogVisible" :title="dialogTitle" width="560px">
    <Write :key="currentRow?.id || 'new'" ref="writeRef" :current-row="currentRow" />

    <template #footer>
      <BaseButton @click="dialogVisible = false">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="saveLoading" @click="handleSave">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </template>
  </Dialog>
</template>
