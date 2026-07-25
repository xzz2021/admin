<script setup lang="tsx">
import { delDictionaryEntryApi, saveDictionaryEntryApi } from '@/api/dictionary'
import type { DictionaryEntryItem } from '@/api/dictionary/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { useClipboard } from '@/hooks/web/useClipboard'
import { useI18n } from '@/hooks/web/useI18n'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElEmpty, ElLink, ElMessage, ElMessageBox, ElTag } from 'element-plus'
import { onMounted, reactive, ref } from 'vue'
import TypeWrite from './components/TypeWrite.vue'
import Write from './components/Write.vue'
import { useDictionaryPage } from './composables/useDictionaryPage'

const { t } = useI18n()
const { copy } = useClipboard()

const {
  dictionaryList,
  listLoading,
  currentTypeId,
  currentType,
  currentTypeCode,
  entryList,
  refreshList,
  selectType,
  setEntryKeyword,
  removeEntriesLocally
} = useDictionaryPage()

onMounted(() => {
  refreshList()
})

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('tableDemo.index'),
    type: 'index',
    width: 60
  },
  {
    field: 'label',
    label: t('tableDemo.title'),
    minWidth: 120
  },
  {
    field: 'value',
    label: t('tableDemo.code'),
    minWidth: 120
  },
  {
    field: 'sort',
    label: t('exampleDemo.sort'),
    width: 80
  },
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
    field: 'createdAt',
    label: t('tableDemo.createdAt'),
    width: 180,
    slots: {
      default: (data: any) => <>{formatToDateTime(data.row.createdAt)}</>
    }
  },
  {
    field: 'action',
    label: t('tableDemo.action'),
    width: 170,
    fixed: 'right',
    slots: {
      default: (data: any) => {
        const row = data.row as DictionaryEntryItem
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
    field: 'keyword',
    label: t('tableDemo.keyword'),
    component: 'Input',
    componentProps: {
      placeholder: '标签 / 编码'
    }
  }
])

const setSearchParams = (data: Recordable) => {
  setEntryKeyword(data.keyword || '')
}

const dialogVisible = ref(false)
const dialogTitle = ref('')
const currentRow = ref<DictionaryEntryItem | null>(null)
const writeRef = ref<InstanceType<typeof Write>>()
const saveLoading = ref(false)

const openDialog = (row?: DictionaryEntryItem) => {
  if (!currentTypeId.value) {
    ElMessage.warning('请先选择字典类型')
    return
  }
  dialogTitle.value = row ? t('exampleDemo.edit') : t('exampleDemo.add')
  currentRow.value = row ?? null
  dialogVisible.value = true
}

const syncEntryAfterSave = async () => {
  if (!currentTypeId.value) return
  await refreshList(currentTypeId.value)
}

const handleDelete = async (row: DictionaryEntryItem) => {
  if (!currentTypeId.value) return

  try {
    await ElMessageBox.confirm(`确认删除字典项「${row.label}」？`, '提示', { type: 'warning' })
    await delDictionaryEntryApi([row.id])
    removeEntriesLocally(currentTypeId.value, [row.id])
    ElMessage.success('删除成功')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
  }
}

const handleSave = async () => {
  const formData = await writeRef.value?.submit()
  if (!formData || !currentTypeId.value) return

  saveLoading.value = true
  try {
    await saveDictionaryEntryApi(formData)
    await syncEntryAfterSave()
    ElMessage.success(formData.id ? '更新成功' : '新增成功')
    dialogVisible.value = false
  } finally {
    saveLoading.value = false
  }
}
</script>

<template>
  <div class="flex w-100% gap-16px">
    <TypeWrite
      :list="dictionaryList"
      :loading="listLoading"
      :current-type-id="currentTypeId"
      @update:current-type-id="selectType"
      @refresh="(selectTypeId) => refreshList(selectTypeId)"
    />

    <ContentWrap class="min-w-0 flex-1">
      <div class="mb-12px flex flex-wrap items-center gap-12px">
        <ElLink v-if="currentTypeCode" type="primary" @click="copy(currentTypeCode)">
          {{ t('tableDemo.code') }}:{{ currentTypeCode }}
        </ElLink>
        <ElTag v-if="currentType && !currentType.enabled" type="info">字典类型已禁用</ElTag>
      </div>

      <div class="mb-12px flex flex-wrap items-end gap-12px">
        <div class="min-w-0 flex-1">
          <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
        </div>
        <BaseButton type="success" class="mb-[18px] flex-shrink-0" :disabled="!currentTypeId" @click="openDialog()">
          {{ t('exampleDemo.add') }}
        </BaseButton>
      </div>

      <Table v-if="currentTypeId" :columns="tableColumns" :data="entryList" :loading="listLoading" />
      <ElEmpty v-else description="请选择左侧字典类型" />

      <Dialog v-model="dialogVisible" :title="dialogTitle" width="480px">
        <Write :key="currentRow?.id || 'new'" ref="writeRef" :current-row="currentRow" :type-id="currentTypeId || ''" />

        <template #footer>
          <BaseButton @click="dialogVisible = false">{{ t('common.cancel') }}</BaseButton>
          <BaseButton type="primary" :loading="saveLoading" @click="handleSave">
            {{ t('exampleDemo.save') }}
          </BaseButton>
        </template>
      </Dialog>
    </ContentWrap>
  </div>
</template>
