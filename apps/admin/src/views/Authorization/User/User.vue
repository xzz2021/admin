<script setup lang="tsx">
import { getDepartmentListApi } from '@/api/department'
import type { DepartmentItem } from '@/api/department/types'
import { getRoleListApi } from '@/api/role'
import { addUserApi, deleteUserApi, getUserByDepartmentIdApi, updateUserApi } from '@/api/user'
import type { UserItem } from '@/api/user/types'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { Dialog } from '@/components/Dialog'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { formatToDateTime } from '@/utils/dateUtil'
import { ElDivider, ElInput, ElTag, ElTree } from 'element-plus'
import { nextTick, onMounted, reactive, ref, unref, watch } from 'vue'
import Detail from './components/Detail.vue'
import Write from './components/Write.vue'

const { t } = useI18n()

const currentNodeKey = ref('')
const departmentList = ref<DepartmentItem[]>([])
const roleMap = ref<Record<string, string>>({})
const searchParams = ref<Recordable>({})
const ids = ref<string[]>([])
const delLoading = ref(false)
const dialogVisible = ref(false)
const dialogTitle = ref('')
const actionType = ref<'add' | 'edit' | 'detail' | ''>('')
const currentRow = ref<UserItem>()
const defaultDepartmentId = ref('')
const writeRef = ref<ComponentRef<typeof Write>>()
const saveLoading = ref(false)
const treeEl = ref<InstanceType<typeof ElTree>>()
const currentDepartment = ref('')

const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const { pageSize, currentPage } = tableState
    const res = await getUserByDepartmentIdApi({
      id: unref(currentNodeKey) || undefined,
      pageIndex: unref(currentPage),
      pageSize: unref(pageSize),
      ...unref(searchParams)
    })
    return {
      list: res.data.list || [],
      total: res.data.total || 0
    }
  },
  fetchDelApi: async () => {
    const res = await deleteUserApi(unref(ids))
    return !!res
  }
})

const { total, loading, dataList, pageSize, currentPage } = tableState
const { getList, getElTableExpose, delList } = tableMethods

const searchSchema = reactive<FormSchema[]>([
  {
    field: 'username',
    label: t('userDemo.username'),
    component: 'Input'
  },
  {
    field: 'phone',
    label: t('login.phone'),
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

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'selection',
    type: 'selection'
  },
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index'
  },
  {
    field: 'username',
    label: t('userDemo.username')
  },
  {
    field: 'phone',
    label: t('login.phone')
  },
  {
    field: 'department.name',
    label: t('userDemo.department'),
    minWidth: 120
  },
  {
    field: 'roles',
    label: t('userDemo.role'),
    minWidth: 160,
    slots: {
      default: (data: any) => {
        const roles = (data.row as UserItem).roles || []
        if (!roles.length) return null
        return (
          <>
            {roles.map((roleId) => (
              <ElTag key={roleId} class="mr-4px mb-4px">
                {roleMap.value[roleId] || roleId}
              </ElTag>
            ))}
          </>
        )
      }
    }
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
    label: t('tableDemo.displayTime'),
    width: 180,
    formatter: (row: UserItem) => formatToDateTime(row.createdAt)
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 240,
    fixed: 'right',
    slots: {
      default: (data: any) => {
        const row = data.row as UserItem
        return (
          <>
            <BaseButton type="primary" onClick={() => openDialog(row, 'edit')}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton type="success" onClick={() => openDialog(row, 'detail')}>
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton type="danger" onClick={() => delData(row)}>
              {t('exampleDemo.del')}
            </BaseButton>
          </>
        )
      }
    }
  }
])

const setSearchParams = (params: Recordable) => {
  currentPage.value = 1
  searchParams.value = params
  getList()
}

const filterNode = (value: string, data: DepartmentItem) => {
  if (!value) return true
  return data.name.includes(value)
}

const currentChange = (data: DepartmentItem) => {
  currentNodeKey.value = data.id
  currentPage.value = 1
  getList()
}

const openDialog = (row: UserItem | undefined, type: 'add' | 'edit' | 'detail') => {
  actionType.value = type
  currentRow.value = row
  defaultDepartmentId.value = type === 'add' ? currentNodeKey.value : ''
  dialogTitle.value = t(
    type === 'add' ? 'exampleDemo.add' : type === 'edit' ? 'exampleDemo.edit' : 'exampleDemo.detail'
  )
  dialogVisible.value = true
}

const delData = async (row?: UserItem) => {
  const elTableExpose = await getElTableExpose()
  ids.value = row ? [row.id] : elTableExpose?.getSelectionRows().map((item: UserItem) => item.id) || []
  if (!ids.value.length) return

  delLoading.value = true
  await delList(unref(ids).length).finally(() => {
    delLoading.value = false
  })
}

const save = async () => {
  const formData = await unref(writeRef)?.submit()
  if (!formData) return

  saveLoading.value = true
  try {
    if ('id' in formData) {
      await updateUserApi(formData)
    } else {
      await addUserApi(formData)
    }
    dialogVisible.value = false
    getList()
  } finally {
    saveLoading.value = false
  }
}

const loadBaseData = async () => {
  const [departmentRes, roleRes] = await Promise.all([getDepartmentListApi(), getRoleListApi()])
  departmentList.value = departmentRes.data.list || []
  roleMap.value = Object.fromEntries((roleRes.data?.list || []).map((role) => [role.id, role.name]))

  currentNodeKey.value = departmentList.value[0]?.id || ''
  await nextTick()
  treeEl.value?.setCurrentKey(currentNodeKey.value)
  getList()
}

watch(currentDepartment, (value) => {
  treeEl.value?.filter(value)
})

onMounted(() => {
  loadBaseData()
})
</script>

<template>
  <div class="flex w-100% h-100%">
    <ContentWrap class="w-250px">
      <div class="flex justify-center items-center">
        <div class="flex-1">{{ t('userDemo.departmentList') }}</div>
        <ElInput v-model="currentDepartment" class="flex-[2]" :placeholder="t('userDemo.searchDepartment')" clearable />
      </div>
      <ElDivider />
      <ElTree
        ref="treeEl"
        :data="departmentList"
        default-expand-all
        :expand-on-click-node="false"
        node-key="id"
        :current-node-key="currentNodeKey"
        :props="{ label: 'name' }"
        :filter-node-method="filterNode"
        @current-change="currentChange"
      >
        <template #default="{ data }">
          <div :title="data.name" class="whitespace-nowrap overflow-ellipsis overflow-hidden">
            {{ data.name }}
          </div>
        </template>
      </ElTree>
    </ContentWrap>

    <ContentWrap class="flex-[3] ml-20px">
      <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />

      <div class="mb-10px">
        <BaseButton type="primary" @click="openDialog(undefined, 'add')">
          {{ t('exampleDemo.add') }}
        </BaseButton>
        <BaseButton :loading="delLoading" type="danger" @click="delData()">
          {{ t('exampleDemo.del') }}
        </BaseButton>
      </div>

      <Table
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :columns="tableColumns"
        :data="dataList"
        :loading="loading"
        :pagination="{ total }"
        @register="tableRegister"
      />
    </ContentWrap>

    <Dialog v-model="dialogVisible" :title="dialogTitle">
      <Write
        v-if="actionType === 'add' || actionType === 'edit'"
        ref="writeRef"
        :current-row="currentRow"
        :default-department-id="defaultDepartmentId"
      />
      <Detail v-else-if="actionType === 'detail'" :current-row="currentRow" :role-map="roleMap" />

      <template #footer>
        <BaseButton
          v-if="actionType === 'add' || actionType === 'edit'"
          type="primary"
          :loading="saveLoading"
          @click="save"
        >
          {{ t('exampleDemo.save') }}
        </BaseButton>
        <BaseButton @click="dialogVisible = false">{{ t('dialogDemo.close') }}</BaseButton>
      </template>
    </Dialog>
  </div>
</template>
