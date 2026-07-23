<script setup lang="tsx">
import { addPermissionApi, delPermissionApi, getMenuListApi, updatePermissionApi } from '@/api/menu'
import type { MenuItem, MenuPermission, PermissionType } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { Form, FormSchema } from '@/components/Form'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElButton, ElMessage, ElPopconfirm, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { cloneDeep, pick } from 'lodash-es'
import { PropType, reactive, ref, unref, watch } from 'vue'
import { filterMenuTreeForParent, findMenuById } from '../utils/menuTree'
import { getPermissionCodeSuffix } from '../utils/permissionCode'
import { isTempPermissionId } from '../utils/syncPermissions'
import AddButtonPermission from './AddButtonPermission.vue'

const { t } = useI18n()
const { required } = useValidator()

const PERMISSION_TYPE_LABELS: Record<PermissionType, string> = {
  BUTTON: '按钮权限',
  DATA: '数据权限',
  API: '接口权限',
  OTHER: '其他'
}

const MENU_FIELDS = [
  'type',
  'parentId',
  'name',
  'path',
  'component',
  'redirect',
  'title',
  'enabled',
  'sort',
  'icon',
  'affix',
  'activeMenu',
  'alwaysShow',
  'breadcrumb',
  'canTo',
  'hidden',
  'noCache',
  'noTagsView',
  'external',
  'link',
  'keepAlive'
] as const

const props = defineProps({
  currentRow: {
    type: Object as PropType<MenuItem | null>,
    default: () => null
  }
})

const emit = defineEmits<{
  'permissions-change': [permissions: MenuPermission[]]
}>()

const normalizePermissions = (list: any[] = []): MenuPermission[] => {
  return list.map((item) => ({
    id: item.id,
    name: item.name ?? item.label ?? '',
    code: item.code ?? item.value ?? '',
    type: (item.type ?? 'BUTTON') as PermissionType,
    sort: item.sort ?? 0,
    enabled: item.enabled ?? true,
    menuId: item.menuId
  }))
}

const normalizeMenuRow = (row: MenuItem | null): Partial<MenuItem> | null => {
  if (!row) return null
  const normalized = cloneDeep(row) as any

  if (normalized.meta) {
    Object.assign(normalized, normalized.meta)
    delete normalized.meta
  }

  if (normalized.status !== undefined && normalized.enabled === undefined) {
    normalized.enabled = normalized.status === 1 || normalized.status === true
    delete normalized.status
  }

  normalized.permissions = normalizePermissions(normalized.permissions ?? normalized.permissionList)
  delete normalized.permissionList

  if (normalized.parentId === 0) {
    normalized.parentId = null
  }

  return normalized
}

const permissionSaving = ref(false)

const getMenuId = async () => {
  const formData = await getFormData()
  return formData.id ?? props.currentRow?.id
}

const reloadPermissionsFromApi = async () => {
  const menuId = await getMenuId()
  if (!menuId) return

  const res = await getMenuListApi()
  const menu = findMenuById(res.data.list || [], menuId)
  const permissions = normalizePermissions(menu?.permissions ?? [])
  await setValues({ permissions })
  emit('permissions-change', permissions)
}

const handleClose = async (row: MenuPermission) => {
  const formData = await getFormData()
  const menuId = await getMenuId()

  try {
    if (menuId && row.id && !isTempPermissionId(row.id)) {
      await delPermissionApi(row.id)
      await reloadPermissionsFromApi()
      ElMessage.success('删除权限成功')
      return
    }

    const permissions = formData?.permissions?.filter((v: MenuPermission) => v.id !== row.id) ?? []
    await setValues({ permissions })
    emit('permissions-change', permissions)
  } catch (error) {
    console.error(error)
    ElMessage.error('删除权限失败')
  }
}

const showDrawer = ref(false)
const editingPermission = ref<MenuPermission | null>(null)
const drawerMenuPath = ref('')

const openPermissionDrawer = async (row?: MenuPermission) => {
  const formData = await getFormData()
  if (!formData.path?.trim()) {
    ElMessage.warning('请先填写菜单路径，再配置权限')
    return
  }
  drawerMenuPath.value = formData.path.trim()
  editingPermission.value = row ? { ...row } : null
  showDrawer.value = true
}
const cacheComponent = ref('')
const editingMenuId = ref<string>()

const COL_FULL = { span: 24 }
const COL_THIRD = { span: 8 }
const COL_TWO_THIRDS = { span: 16 }

const formSchema = reactive<FormSchema[]>([
  {
    field: 'type',
    label: '菜单类型',
    component: 'RadioButton',
    value: 0,
    colProps: COL_FULL,
    componentProps: {
      options: [
        { label: '目录', value: 0 },
        { label: '菜单', value: 1 }
      ],
      on: {
        change: async (val: number) => {
          const formData = await getFormData()
          if (val === 1) {
            setSchema([{ field: 'component', path: 'componentProps.disabled', value: false }])
            setValues({ component: unref(cacheComponent) })
          } else {
            setSchema([{ field: 'component', path: 'componentProps.disabled', value: true }])
            setValues({
              component: formData.parentId ? '##' : '#'
            })
          }
        }
      }
    }
  },
  {
    field: 'divider-basic',
    label: '基础信息',
    component: 'Divider',
    colProps: COL_FULL
  },
  {
    field: 'parentId',
    label: '父级菜单',
    component: 'TreeSelect',
    colProps: COL_THIRD,
    componentProps: {
      nodeKey: 'id',
      props: {
        label: (data: MenuItem) => t(data.title || ''),
        children: 'children',
        disabled: (data: MenuItem) => data.type === 1
      },
      highlightCurrent: true,
      expandOnClickNode: false,
      checkStrictly: true,
      checkOnClickNode: true,
      clearable: true,
      defaultExpandAll: true,
      placeholder: '不选则为顶级菜单',
      on: {
        change: async (val: string | null) => {
          const formData = await getFormData()
          if (formData.type === 0) {
            setValues({ component: val ? '##' : '#' })
          } else if (formData.type === 1) {
            setValues({ component: unref(cacheComponent) ?? '' })
          }
        }
      }
    },
    optionApi: async () => {
      const res = await getMenuListApi()
      return filterMenuTreeForParent(res.data.list || [], editingMenuId.value)
    }
  },
  {
    field: 'title',
    label: t('menu.name'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'name',
    label: t('menu.name'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'path',
    label: t('menu.path'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'redirect',
    label: '重定向',
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    value: 0,
    colProps: COL_THIRD,
    componentProps: { min: 0 }
  },
  {
    field: 'component',
    label: '组件',
    component: 'Input',
    value: '#',
    colProps: COL_TWO_THIRDS,
    componentProps: {
      disabled: true,
      placeholder: '#为顶级目录，##为子目录',
      on: {
        change: (val: string) => {
          cacheComponent.value = val
        }
      }
    }
  },
  {
    field: 'activeMenu',
    label: t('menu.activeMenu'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'icon',
    label: t('menu.icon'),
    component: 'IconPicker',
    colProps: COL_THIRD
  },
  {
    field: 'enabled',
    label: t('menu.status'),
    component: 'Switch',
    value: true,
    colProps: COL_THIRD,
    componentProps: {
      inlinePrompt: true,
      activeText: t('userDemo.enable'),
      inactiveText: t('userDemo.disable')
    }
  },
  {
    field: 'divider-display',
    label: '显示设置',
    component: 'Divider',
    colProps: COL_FULL
  },
  {
    field: 'external',
    label: '外部链接',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'link',
    label: '链接地址',
    component: 'Input',
    colProps: COL_TWO_THIRDS,
    componentProps: {
      placeholder: 'https://example.com'
    }
  },
  {
    field: 'hidden',
    label: '隐藏',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'alwaysShow',
    label: '一直显示',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'noCache',
    label: '清除缓存',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'keepAlive',
    label: '页面缓存',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'breadcrumb',
    label: '显示面包屑',
    component: 'Switch',
    value: true,
    colProps: COL_THIRD
  },
  {
    field: 'affix',
    label: '固定标签页',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'noTagsView',
    label: '隐藏标签页',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'canTo',
    label: '可跳转',
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'divider-permission',
    label: t('menu.permission'),
    component: 'Divider',
    colProps: COL_FULL
  },
  {
    field: 'permissions',
    label: '',
    component: 'CheckboxGroup',
    colProps: COL_FULL,
    formItemProps: {
      labelWidth: '0px',
      slots: {
        default: (data: any) => (
          <>
            <BaseButton class="m-t-5px" type="primary" size="small" onClick={() => openPermissionDrawer()}>
              添加权限
            </BaseButton>
            <ElTable
              key={JSON.stringify(data?.permissions?.map((p: MenuPermission) => p.id))}
              data={data?.permissions}
              class="mt-10px"
            >
              <ElTableColumn type="index" width="50" />
              <ElTableColumn prop="name" label="名称" />
              <ElTableColumn
                prop="code"
                label="编码"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <span title={row.code}>{getPermissionCodeSuffix(row.code, data?.path)}</span>
                  )
                }}
              />
              <ElTableColumn
                prop="type"
                label="类型"
                width="100"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <ElTag size="small">{PERMISSION_TYPE_LABELS[row.type] ?? row.type}</ElTag>
                  )
                }}
              />
              <ElTableColumn
                prop="enabled"
                label="状态"
                width="80"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <ElTag type={row.enabled ? 'success' : 'danger'} size="small">
                      {row.enabled ? '启用' : '禁用'}
                    </ElTag>
                  )
                }}
              />
              <ElTableColumn
                label="操作"
                width="140"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <>
                      <ElButton size="small" type="primary" onClick={() => openPermissionDrawer(row)}>
                        编辑
                      </ElButton>
                      <ElPopconfirm title="确认删除该权限？" onConfirm={() => handleClose(row)}>
                        {{
                          reference: () => (
                            <ElButton size="small" type="danger">
                              删除
                            </ElButton>
                          )
                        }}
                      </ElPopconfirm>
                    </>
                  )
                }}
              />
            </ElTable>
          </>
        )
      }
    }
  }
])

const rules = reactive({
  component: [required()],
  path: [required()],
  title: [required()],
  name: [required()]
})

const { formRegister, formMethods } = useForm()
const { setValues, getFormData, getElFormExpose, setSchema } = formMethods

const buildMenuPayload = (formData: Recordable) => {
  const payload = pick(formData, MENU_FIELDS) as Recordable
  if (!payload.parentId) {
    payload.parentId = null
  }
  if (formData.id) {
    payload.id = formData.id
  }
  return payload
}

const submit = async () => {
  const elForm = await getElFormExpose()
  const valid = await elForm?.validate().catch((err) => {
    console.log(err)
  })
  if (valid) {
    const formData = await getFormData()
    return {
      menu: buildMenuPayload(formData),
      permissions: normalizePermissions(formData.permissions)
    }
  }
}

watch(
  () => props.currentRow?.id ?? '__new__',
  () => {
    editingMenuId.value = props.currentRow?.id
    const currentRow = normalizeMenuRow(props.currentRow)
    if (!currentRow) {
      cacheComponent.value = ''
      setValues({
        type: 0,
        parentId: null,
        enabled: true,
        sort: 0,
        component: '#',
        permissions: [],
        breadcrumb: true
      })
      setSchema([{ field: 'component', path: 'componentProps.disabled', value: true }])
      return
    }

    cacheComponent.value = currentRow.type === 1 ? (currentRow.component ?? '') : ''
    const isDirectory = currentRow.type !== 1
    setSchema([
      {
        field: 'component',
        path: 'componentProps.disabled',
        value: isDirectory
      }
    ])
    setValues(currentRow)
  },
  { immediate: true }
)

defineExpose({ submit })

const confirmPermission = async (data: MenuPermission) => {
  const formData = await getFormData()
  const permissions = [...(formData?.permissions || [])]
  const duplicate = permissions.some((item) => item.code === data.code && item.id !== data.id)
  if (duplicate) {
    ElMessage.warning('权限编码已存在')
    return
  }

  const payload = {
    name: data.name,
    code: data.code,
    type: data.type,
    sort: data.sort ?? 0,
    enabled: data.enabled ?? true
  }

  permissionSaving.value = true
  try {
    const menuId = await getMenuId()

    if (menuId) {
      if (data.id && !isTempPermissionId(data.id)) {
        await updatePermissionApi({ id: data.id, ...payload })
      } else {
        await addPermissionApi({ ...payload, menuId })
      }
      await reloadPermissionsFromApi()
      ElMessage.success('保存权限成功')
    } else {
      const savedPermission: MenuPermission = {
        ...payload,
        id: data.id && !isTempPermissionId(data.id) ? data.id : `temp_${Date.now()}`
      }

      if (data.id) {
        const index = permissions.findIndex((item) => item.id === data.id)
        if (index !== -1) {
          permissions[index] = { ...permissions[index], ...savedPermission }
        } else {
          permissions.push(savedPermission)
        }
      } else {
        permissions.push(savedPermission)
      }

      await setValues({ permissions })
      emit('permissions-change', permissions)
    }

    showDrawer.value = false
  } catch (error) {
    console.error(error)
    ElMessage.error('保存权限失败')
  } finally {
    permissionSaving.value = false
  }
}
</script>

<template>
  <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" class="menu-write-form" />
  <AddButtonPermission
    v-model="showDrawer"
    :menu-path="drawerMenuPath"
    :edit-data="editingPermission"
    :confirm-loading="permissionSaving"
    @confirm="confirmPermission"
  />
</template>

<style scoped lang="less">
.menu-write-form {
  :deep(.el-divider__text) {
    font-size: 14px;
    font-weight: 600;
  }

  :deep(.el-form-item) {
    margin-bottom: 16px;
  }

  :deep(.el-switch) {
    --el-switch-on-color: var(--el-color-primary);
  }
}
</style>
