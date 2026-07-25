<script setup lang="tsx">
import { addPermissionApi, delPermissionApi, getMenuListApi, updatePermissionApi } from '@/api/menu'
import type { MenuItem, MenuPermission, PermissionType } from '@/api/menu/types'
import { BaseButton } from '@/components/Button'
import { Form, FormSchema } from '@/components/Form'
import { Icon } from '@/components/Icon'
import { useClipboard } from '@/hooks/web/useClipboard'
import { useForm } from '@/hooks/web/useForm'
import { useI18n } from '@/hooks/web/useI18n'
import { useValidator } from '@/hooks/web/useValidator'
import { ElButton, ElMessage, ElMessageBox, ElPopconfirm, ElTable, ElTableColumn, ElTag } from 'element-plus'
import { cloneDeep, pick } from 'lodash-es'
import { computed, PropType, reactive, ref, unref, watch } from 'vue'
import {
  buildMenuFormSnapshot,
  collectMenuIds,
  collectMenuNames,
  parseMenuFormSnapshot,
  prepareMenuFormImport
} from '../utils/menuFormSnapshot'
import { filterMenuTreeForParent, findMenuById } from '../utils/menuTree'
import { getPermissionCodeSuffix } from '../utils/permissionCode'
import {
  adaptPermissionSnapshotToMenu,
  buildMenuPermissionSnapshot,
  parseMenuPermissionSnapshot
} from '../utils/permissionSnapshot'
import { isTempPermissionId } from '../utils/syncPermissions'
import AddButtonPermission from './AddButtonPermission.vue'

const { t } = useI18n()
const { required } = useValidator()
const { copy, getText } = useClipboard()

const getPermissionTypeLabel = (type: PermissionType) => {
  const map: Record<PermissionType, string> = {
    BUTTON: t('menu.permissionTypeButton'),
    DATA: t('menu.permissionTypeData'),
    API: t('menu.permissionTypeApi'),
    OTHER: t('menu.permissionTypeOther')
  }
  return map[type] ?? type
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
const permissionImporting = ref(false)
const formImporting = ref(false)
const cacheComponent = ref('')
const editingMenuId = ref<string>()
const isEditMode = computed(() => !!editingMenuId.value)

const getMenuId = async () => {
  const formData = await getFormData()
  return formData.id ?? props.currentRow?.id
}

const applyMenuTypeSchema = async (type: number, componentValue?: string) => {
  if (type === 1) {
    setSchema([{ field: 'component', path: 'componentProps.disabled', value: false }])
    if (componentValue !== undefined) {
      setValues({ component: componentValue })
      cacheComponent.value = componentValue
    }
  } else {
    setSchema([{ field: 'component', path: 'componentProps.disabled', value: true }])
  }
}

const handleCopyMenuForm = async () => {
  const formData = await getFormData()
  if (!formData?.title && !formData?.path && !formData?.name) {
    ElMessage.warning(t('menu.copyFormEmpty'))
    return
  }
  const snapshot = buildMenuFormSnapshot(formData)
  copy(JSON.stringify(snapshot, null, 2))
}

const handleImportMenuForm = async () => {
  const clipboardText = await getText()
  if (!clipboardText?.trim()) {
    ElMessage.warning(t('menu.importFormEmpty'))
    return
  }

  const snapshot = parseMenuFormSnapshot(clipboardText.trim())
  if (!snapshot) {
    ElMessage.error(t('menu.importFormInvalid'))
    return
  }

  formImporting.value = true
  try {
    const res = await getMenuListApi()
    const list = res.data.list || []
    const { values, nameConflict, parentCleared } = prepareMenuFormImport(snapshot, {
      existingNames: collectMenuNames(list, editingMenuId.value),
      existingIds: collectMenuIds(list)
    })

    const type = values.type ?? 0
    await applyMenuTypeSchema(type, type === 1 ? (values.component ?? '') : undefined)

    if (type === 0) {
      values.component = values.parentId ? '##' : '#'
    }

    await setValues(values)

    if (nameConflict) {
      ElMessage.warning(t('menu.importFormNameConflict'))
    } else if (parentCleared) {
      ElMessage.warning(t('menu.importFormParentCleared'))
    } else {
      ElMessage.success(t('menu.importFormSuccess'))
    }
  } catch (error) {
    console.error(error)
    ElMessage.error(t('menu.importFormFailed'))
  } finally {
    formImporting.value = false
  }
}

const handleCopyPermissions = async () => {
  const formData = await getFormData()
  const permissions = normalizePermissions(formData?.permissions)
  if (!permissions.length) {
    ElMessage.warning(t('menu.copyPermissionEmpty'))
    return
  }
  const snapshot = buildMenuPermissionSnapshot(permissions, formData?.path)
  copy(JSON.stringify(snapshot, null, 2))
}

const handleImportPermissions = async () => {
  const menuId = await getMenuId()
  if (!menuId) {
    ElMessage.warning(t('menu.importPermissionNeedSave'))
    return
  }

  const formData = await getFormData()
  const menuPath = formData?.path?.trim()
  if (!menuPath) {
    ElMessage.warning(t('menu.importPermissionNeedPath'))
    return
  }

  const clipboardText = await getText()
  if (!clipboardText?.trim()) {
    ElMessage.warning(t('menu.importPermissionEmpty'))
    return
  }

  const snapshot = parseMenuPermissionSnapshot(clipboardText.trim())
  if (!snapshot) {
    ElMessage.error(t('menu.importPermissionInvalid'))
    return
  }

  const existingCodes = new Set(normalizePermissions(formData?.permissions).map((item) => item.code))
  const { toCreate, skippedDuplicate } = adaptPermissionSnapshotToMenu(snapshot, menuPath, existingCodes)

  if (!toCreate.length) {
    ElMessage.warning(skippedDuplicate > 0 ? t('menu.importPermissionAllDuplicate') : t('menu.importPermissionEmpty'))
    return
  }

  try {
    await ElMessageBox.confirm(t('menu.importPermissionConfirm', { count: toCreate.length }), t('common.reminder'), {
      confirmButtonText: t('common.ok'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
  } catch {
    return
  }

  permissionImporting.value = true
  try {
    let successCount = 0
    for (const item of toCreate) {
      await addPermissionApi({
        name: item.name,
        code: item.code,
        type: item.type,
        sort: item.sort ?? 0,
        enabled: item.enabled ?? true,
        menuId
      })
      successCount++
    }
    await reloadPermissionsFromApi()
    ElMessage.success(
      t('menu.importPermissionSuccess', {
        count: successCount,
        skipped: skippedDuplicate
      })
    )
  } catch (error) {
    console.error(error)
    ElMessage.error(t('menu.importPermissionFailed'))
    await reloadPermissionsFromApi()
  } finally {
    permissionImporting.value = false
  }
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
      ElMessage.success(t('menu.deletePermissionSuccess'))
      return
    }

    const permissions = formData?.permissions?.filter((v: MenuPermission) => v.id !== row.id) ?? []
    await setValues({ permissions })
    emit('permissions-change', permissions)
  } catch (error) {
    console.error(error)
    ElMessage.error(t('menu.deletePermissionFailed'))
  }
}

const showDrawer = ref(false)
const editingPermission = ref<MenuPermission | null>(null)
const drawerMenuPath = ref('')

const openPermissionDrawer = async (row?: MenuPermission) => {
  const formData = await getFormData()
  if (!formData.path?.trim()) {
    ElMessage.warning(t('menu.pathRequiredForPermission'))
    return
  }
  drawerMenuPath.value = formData.path.trim()
  editingPermission.value = row ? { ...row } : null
  showDrawer.value = true
}

const COL_FULL = { span: 24 }
const COL_THIRD = { span: 8 }
const COL_TWO_THIRDS = { span: 16 }

const formSchema = reactive<FormSchema[]>([
  {
    field: 'type',
    label: t('menu.menuType'),
    component: 'RadioButton',
    value: 0,
    colProps: COL_FULL,
    componentProps: {
      options: [
        { label: t('menu.directoryType'), value: 0 },
        { label: t('menu.menuItemType'), value: 1 }
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
    label: t('menu.basicInfo'),
    component: 'Divider',
    colProps: COL_FULL
  },
  {
    field: 'parentId',
    label: t('userDemo.superior'),
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
      placeholder: t('menu.parentMenuPlaceholder'),
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
    label: t('menu.title'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'name',
    label: t('menu.componentName'),
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
    label: t('menu.redirect'),
    component: 'Input',
    colProps: COL_THIRD
  },
  {
    field: 'sort',
    label: t('menu.sortOrder'),
    component: 'InputNumber',
    value: 0,
    colProps: COL_THIRD,
    componentProps: { min: 0 }
  },
  {
    field: 'component',
    label: t('menu.component'),
    component: 'Input',
    value: '#',
    colProps: COL_TWO_THIRDS,
    componentProps: {
      disabled: true,
      placeholder: t('menu.componentPlaceholder'),
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
    label: t('menu.displaySettings'),
    component: 'Divider',
    colProps: COL_FULL
  },
  {
    field: 'external',
    label: t('menu.externalLink'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'link',
    label: t('menu.linkUrl'),
    component: 'Input',
    colProps: COL_TWO_THIRDS,
    componentProps: {
      placeholder: 'https://example.com'
    }
  },
  {
    field: 'hidden',
    label: t('menu.hidden'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'alwaysShow',
    label: t('menu.alwaysShow'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'noCache',
    label: t('menu.noCache'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'keepAlive',
    label: t('menu.keepAlive'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'breadcrumb',
    label: t('menu.breadcrumb'),
    component: 'Switch',
    value: true,
    colProps: COL_THIRD
  },
  {
    field: 'affix',
    label: t('menu.affix'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'noTagsView',
    label: t('menu.noTagsView'),
    component: 'Switch',
    colProps: COL_THIRD
  },
  {
    field: 'canTo',
    label: t('menu.canTo'),
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
            <div class="flex flex-wrap gap-8px items-center mt-5px">
              <BaseButton type="primary" size="small" onClick={() => openPermissionDrawer()}>
                {t('menu.addPermission')}
              </BaseButton>
              <BaseButton size="small" onClick={() => handleCopyPermissions()}>
                <Icon icon="copy" class="mr-4px" />
                {t('menu.copyPermission')}
              </BaseButton>
              <BaseButton
                size="small"
                disabled={!isEditMode.value}
                loading={permissionImporting.value}
                onClick={() => handleImportPermissions()}
              >
                <Icon icon="clipboard-paste" class="mr-4px" />
                {t('menu.importPermission')}
              </BaseButton>
            </div>
            <ElTable
              key={JSON.stringify(data?.permissions?.map((p: MenuPermission) => p.id))}
              data={data?.permissions}
              class="mt-10px"
            >
              <ElTableColumn type="index" width="50" />
              <ElTableColumn prop="name" label={t('common.name')} />
              <ElTableColumn
                prop="code"
                label={t('common.code')}
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <span title={row.code}>{getPermissionCodeSuffix(row.code, data?.path)}</span>
                  )
                }}
              />
              <ElTableColumn
                prop="type"
                label={t('common.type')}
                width="100"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <ElTag size="small">{getPermissionTypeLabel(row.type)}</ElTag>
                  )
                }}
              />
              <ElTableColumn
                prop="enabled"
                label={t('menu.status')}
                width="80"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <ElTag type={row.enabled ? 'success' : 'danger'} size="small">
                      {row.enabled ? t('userDemo.enable') : t('userDemo.disable')}
                    </ElTag>
                  )
                }}
              />
              <ElTableColumn
                label={t('userDemo.action')}
                width="140"
                v-slots={{
                  default: ({ row }: { row: MenuPermission }) => (
                    <>
                      <ElButton size="small" type="primary" onClick={() => openPermissionDrawer(row)}>
                        {t('common.edit')}
                      </ElButton>
                      <ElPopconfirm title={t('menu.confirmDeletePermission')} onConfirm={() => handleClose(row)}>
                        {{
                          reference: () => (
                            <ElButton size="small" type="danger">
                              {t('exampleDemo.del')}
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

const pageMenuTitle = computed(() => {
  const title = props.currentRow?.title?.trim()
  if (title) return t(title)
  return t('menu.addMenu')
})

defineExpose({ submit })

const confirmPermission = async (data: MenuPermission) => {
  const formData = await getFormData()
  const permissions = [...(formData?.permissions || [])]
  const duplicate = permissions.some((item) => item.code === data.code && item.id !== data.id)
  if (duplicate) {
    ElMessage.warning(t('menu.permissionCodeExists'))
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
      ElMessage.success(t('menu.savePermissionSuccess'))
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
    ElMessage.error(t('menu.savePermissionFailed'))
  } finally {
    permissionSaving.value = false
  }
}
</script>

<template>
  <div class="menu-write">
    <div class="menu-write-toolbar">
      <div class="menu-write-title">{{ pageMenuTitle }}</div>
      <div class="menu-write-actions">
        <BaseButton :loading="formImporting" @click="handleImportMenuForm">
          <Icon icon="clipboard-paste" class="mr-4px" />
          {{ t('menu.writeForm') }}
        </BaseButton>
        <BaseButton @click="handleCopyMenuForm">
          <Icon icon="copy" class="mr-4px" />
          {{ t('menu.copyForm') }}
        </BaseButton>
      </div>
    </div>

    <Form :rules="rules" label-width="96px" @register="formRegister" :schema="formSchema" class="menu-write-form" />
    <AddButtonPermission
      v-model="showDrawer"
      :menu-path="drawerMenuPath"
      :edit-data="editingPermission"
      :confirm-loading="permissionSaving"
      @confirm="confirmPermission"
    />
  </div>
</template>

<style scoped lang="less">
.menu-write {
  .menu-write-toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .menu-write-title {
    min-width: 0;
    overflow: hidden;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menu-write-actions {
    display: flex;
    flex-shrink: 0;
    gap: 8px;
  }
}

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
