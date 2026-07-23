<script setup lang="tsx">
import { delRoleApi, getRoleListApi } from '@/api/role'
import type { RoleItem } from '@/api/role/type'
import { BaseButton } from '@/components/Button'
import { ContentWrap } from '@/components/ContentWrap'
import { FormSchema } from '@/components/Form'
import { Search } from '@/components/Search'
import { Table, TableColumn } from '@/components/Table'
import { useI18n } from '@/hooks/web/useI18n'
import { useTable } from '@/hooks/web/useTable'
import { ElTag } from 'element-plus'
import { onActivated, reactive, ref, unref } from 'vue'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
const ids = ref<string[]>([])

const searchParams = ref<Recordable>({})

const { tableRegister, tableState, tableMethods } = useTable({
  fetchDataApi: async () => {
    const { pageSize, currentPage } = tableState
    const res = await getRoleListApi({
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
    const res = await delRoleApi(unref(ids))
    return !!res
  }
})

const { dataList, loading, total, currentPage, pageSize } = tableState
const { getList, delList } = tableMethods

const tableColumns = reactive<TableColumn[]>([
  {
    field: 'index',
    label: t('userDemo.index'),
    type: 'index'
  },
  {
    field: 'name',
    label: t('role.roleName')
  },
  {
    field: 'code',
    label: t('role.roleCode')
  },
  {
    field: 'enabled',
    label: t('menu.status'),
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
    label: t('tableDemo.displayTime')
  },
  {
    field: 'description',
    label: t('userDemo.remark')
  },
  {
    field: 'action',
    label: t('userDemo.action'),
    width: 260,
    slots: {
      default: (data: any) => {
        const row = data.row as RoleItem & { isSystem?: boolean }
        return (
          <>
            <BaseButton type="success" onClick={() => handleDetail(row)}>
              {t('exampleDemo.detail')}
            </BaseButton>
            <BaseButton disabled={row.isSystem} type="primary" onClick={() => handleEdit(row)}>
              {t('exampleDemo.edit')}
            </BaseButton>
            <BaseButton disabled={row.isSystem} type="danger" onClick={() => delAction(row.id)}>
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
    label: `${t('role.roleName')}/${t('role.roleCode')}`,
    component: 'Input',
    componentProps: {
      placeholder: t('role.roleKeywordPlaceholder')
    }
  }
])

const setSearchParams = (data: Recordable) => {
  currentPage.value = 1
  searchParams.value = data
  getList()
}

const handleEdit = (row: RoleItem) => {
  router.push({
    name: 'RoleAssignMenuPermission',
    params: { id: row.id },
    state: {
      role: {
        id: row.id,
        name: row.name,
        code: row.code,
        enabled: row.enabled,
        description: row.description ?? ''
      }
    }
  })
}

const handleDetail = (row: RoleItem) => {
  router.push({
    name: 'RoleDetail',
    params: { id: row.id },
    state: {
      role: {
        id: row.id,
        name: row.name,
        code: row.code,
        enabled: row.enabled,
        description: row.description ?? '',
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
      }
    }
  })
}

const delAction = async (id: string) => {
  ids.value = [id]
  await delList(unref(ids).length)
}

const AddAction = () => {
  router.push({ name: 'RoleAssignMenuPermission' })
}

onActivated(() => {
  if (history.state?.refresh) {
    getList()
    history.replaceState({ ...history.state, refresh: false }, '')
  }
})
</script>

<template>
  <ContentWrap>
    <div class="mb-12px flex flex-wrap items-end gap-12px">
      <div class="min-w-0 flex-1">
        <Search :schema="searchSchema" @reset="setSearchParams" @search="setSearchParams" />
      </div>
      <BaseButton type="success" class="mb-[18px] flex-shrink-0" @click="AddAction">
        {{ t('exampleDemo.add') }}
      </BaseButton>
    </div>
    <Table
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :columns="tableColumns"
      node-key="id"
      :data="dataList"
      :loading="loading"
      :pagination="{ total }"
      @register="tableRegister"
    />
  </ContentWrap>
</template>
