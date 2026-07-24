<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { eachTree } from '@/utils/tree'
import { ElCheckbox, ElForm, ElFormItem, ElInput, ElSwitch, ElTag, ElTree } from 'element-plus'
import { computed, nextTick, PropType, ref, watch } from 'vue'

const emit = defineEmits<{
  cancel: []
  save: []
}>()

const treeRef = ref<InstanceType<typeof ElTree>>()
const menuSearch = ref('')
const currentMenu = ref<MenuTreeNode>()
const isExpandAll = ref(true)
const permissionChangeTick = ref(0)

const { t } = useI18n()

export interface RoleFormModel {
  id?: string
  menu?: MenuTreeNode[]
  name: string
  code: string
  enabled: boolean
  description?: string
}

export interface RoleSubmitData {
  code: string
  name: string
  enabled: boolean
  description: string
  menus: {
    id: string
    permissionIds: string[]
  }[]
}

interface PermissionItem {
  id: string
  name: string
  code: string
  type: string
  checked?: boolean
}

interface MenuTreeNode {
  id: string
  title: string
  checked?: boolean
  permissions?: PermissionItem[]
  children?: MenuTreeNode[]
}

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  BUTTON: '页面操作',
  DATA: '数据操作',
  API: '状态操作',
  OTHER: '其他权限'
}

const props = defineProps({
  menuTree: {
    type: Array as PropType<MenuTreeNode[]>,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  },
  saveLoading: {
    type: Boolean,
    default: false
  }
})

const roleFormModel = defineModel<RoleFormModel>('roleForm', { required: true })

const filterTreeNode = (value: string, data: MenuTreeNode) => {
  if (!value) return true
  return data.title?.toLowerCase().includes(value.toLowerCase())
}

watch(menuSearch, (value) => {
  treeRef.value?.filter(value)
})

const findFirstMenuNode = (tree: MenuTreeNode[]): MenuTreeNode | undefined => {
  for (const node of tree) {
    if (node.permissions?.length) return node
    if (node.children?.length) {
      const found = findFirstMenuNode(node.children)
      if (found) return found
    }
  }
  return tree[0]
}

const bumpPermissionChange = () => {
  permissionChangeTick.value++
}

const getMenuCheckedPermissionCount = (node: MenuTreeNode) => {
  return node.permissions?.filter((permission) => permission.checked).length ?? 0
}

const clearMenuPermissions = (node: MenuTreeNode) => {
  node.permissions?.forEach((permission) => {
    permission.checked = false
  })
}

const syncMenuCheckedState = () => {
  const checkedKeys = new Set(treeRef.value?.getCheckedKeys(false) || [])
  eachTree(props.menuTree, (node) => {
    const checked = checkedKeys.has(node.id)
    if (!checked) {
      clearMenuPermissions(node)
    }
    node.checked = checked
  })
  bumpPermissionChange()
}

const checkMenuNode = (node: MenuTreeNode) => {
  if (node.checked) return
  // deep=false：仅勾选当前节点及祖先，不联动勾选子节点
  treeRef.value?.setChecked(node.id, true, false)
  syncMenuCheckedState()
}

const handleCheckChange = (_node: MenuTreeNode, _checked: boolean) => {
  syncMenuCheckedState()
}

watch(
  () => props.menuTree,
  async (tree) => {
    if (!tree.length) {
      currentMenu.value = undefined
      return
    }
    await nextTick()
    const checkedIds: string[] = []
    eachTree(tree, (node) => {
      if (node.checked) checkedIds.push(node.id)
    })
    treeRef.value?.setCheckedKeys(checkedIds, false)
    syncMenuCheckedState()
    if (!currentMenu.value) {
      currentMenu.value = findFirstMenuNode(tree)
    }
  },
  { immediate: true, deep: true }
)

const handleNodeClick = (node: MenuTreeNode) => {
  currentMenu.value = node
}

const selectedMenuCount = computed(() => {
  let count = 0
  eachTree(props.menuTree, (node) => {
    if (node.checked) count++
  })
  return count
})

const selectedPermissionCount = computed(() => {
  permissionChangeTick.value
  let count = 0
  eachTree(props.menuTree, (node) => {
    node.permissions?.forEach((permission) => {
      if (permission.checked) count++
    })
  })
  return count
})

const menuCheckedPermissionCountMap = computed(() => {
  permissionChangeTick.value
  const map: Record<string, number> = {}
  eachTree(props.menuTree, (node) => {
    const count = getMenuCheckedPermissionCount(node)
    if (count > 0) {
      map[node.id] = count
    }
  })
  return map
})

const currentMenuPermissions = computed(() => currentMenu.value?.permissions || [])

const permissionGroups = computed(() => {
  const groups = new Map<string, PermissionItem[]>()
  currentMenuPermissions.value.forEach((permission) => {
    const type = permission.type || 'OTHER'
    const list = groups.get(type) || []
    list.push(permission)
    groups.set(type, list)
  })
  return Array.from(groups.entries()).map(([type, permissions]) => ({
    type,
    label: PERMISSION_TYPE_LABELS[type] || '其他权限',
    permissions
  }))
})

const isCurrentMenuAllChecked = computed(() => {
  const permissions = currentMenuPermissions.value
  return permissions.length > 0 && permissions.every((item) => item.checked)
})

const toggleCurrentMenuPermissions = (checked: boolean) => {
  currentMenuPermissions.value.forEach((permission) => {
    permission.checked = checked
  })
  bumpPermissionChange()
  if (checked && currentMenu.value) {
    checkMenuNode(currentMenu.value)
  }
}

const togglePermission = (permission: PermissionItem, checked: boolean) => {
  permission.checked = checked
  bumpPermissionChange()
  if (checked && currentMenu.value) {
    checkMenuNode(currentMenu.value)
  }
}

const toggleExpandAll = () => {
  isExpandAll.value = !isExpandAll.value
  const nodes = treeRef.value?.store?.nodesMap
  if (!nodes) return
  Object.values(nodes).forEach((node: any) => {
    node.expanded = isExpandAll.value
  })
}

const collectSubmitData = (): RoleSubmitData => {
  const menus: RoleSubmitData['menus'] = []

  eachTree(props.menuTree, (node) => {
    if (!node.checked) return

    const permissionIds =
      node.permissions?.filter((permission) => permission.checked).map((permission) => permission.id) || []

    menus.push({
      id: node.id,
      permissionIds
    })
  })

  return {
    code: roleFormModel.value.code,
    name: roleFormModel.value.name,
    enabled: roleFormModel.value.enabled,
    description: roleFormModel.value.description || '',
    menus
  }
}

defineExpose({
  collectSubmitData
})
</script>

<template>
  <div v-loading="loading" class="assign-menu-permission">
    <div class="role-info-card mb-20px">
      <ElForm inline label-width="80px">
        <ElFormItem :label="t('role.roleName')">
          <ElInput v-model="roleFormModel.name" class="!w-220px" :placeholder="t('role.roleNamePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="t('role.roleCode')">
          <ElInput v-model="roleFormModel.code" class="!w-220px" :placeholder="t('role.roleCodePlaceholder')" />
        </ElFormItem>
        <ElFormItem :label="t('userDemo.description')">
          <ElInput v-model="roleFormModel.description" class="!w-220px" type="textarea" :rows="1" />
        </ElFormItem>
        <ElFormItem :label="t('menu.status')">
          <ElSwitch
            v-model="roleFormModel.enabled"
            inline-prompt
            :active-text="t('userDemo.enable')"
            :inactive-text="t('userDemo.disable')"
          />
        </ElFormItem>
      </ElForm>
    </div>

    <div class="permission-layout">
      <div class="permission-panel">
        <div class="panel-header">{{ t('role.menuList') }}</div>
        <ElInput v-model="menuSearch" class="mb-12px" :placeholder="t('role.menuSearchPlaceholder')" clearable>
          <template #prefix>
            <Icon icon="search" />
          </template>
        </ElInput>
        <!-- title需要使用i18n -->
        <div class="menu-tree-wrap">
          <ElTree
            ref="treeRef"
            :data="menuTree"
            node-key="id"
            show-checkbox
            highlight-current
            :expand-on-click-node="false"
            :default-expand-all="isExpandAll"
            :filter-node-method="filterTreeNode"
            :props="{ label: 'title', children: 'children' }"
            @node-click="handleNodeClick"
            @check-change="handleCheckChange"
          >
            <template #default="{ data }">
              <span class="tree-node-content">
                <span class="tree-node-label">{{ t(data.title) }}</span>
                <span v-if="menuCheckedPermissionCountMap[data.id]" class="tree-node-permission-count">
                  {{ menuCheckedPermissionCountMap[data.id] }}
                </span>
              </span>
            </template>
          </ElTree>
        </div>

        <div class="panel-footer">
          <span class="text-gray-500">{{ t('role.selectedMenuCount', { count: selectedMenuCount }) }}</span>
          <span class="link-text" @click="toggleExpandAll">
            {{ isExpandAll ? t('role.collapseAll') : t('role.expandAll') }}
          </span>
        </div>
      </div>

      <div class="permission-panel">
        <div class="panel-header flex justify-between items-center">
          <div class="flex items-center gap-2">
            <ElTag> {{ currentMenu?.title ? t(currentMenu.title) : t('role.permissionConfig') }}</ElTag>
            <span>
              {{ currentMenu?.title ? t('role.menuPermissionTitle') : t('role.permissionConfig') }}
            </span>
          </div>
          <BaseButton
            v-if="currentMenuPermissions.length"
            link
            type="primary"
            @click="toggleCurrentMenuPermissions(!isCurrentMenuAllChecked)"
          >
            {{ t('role.selectAll') }}
          </BaseButton>
        </div>

        <div v-if="currentMenu" class="permission-tip mb-16px">
          {{ t('role.permissionConfigTip') }}
        </div>

        <div v-if="!currentMenu" class="empty-permission">
          {{ t('role.selectMenuTip') }}
        </div>

        <template v-else-if="permissionGroups.length">
          <div v-for="group in permissionGroups" :key="group.type" class="permission-group">
            <div class="group-title">
              <span class="group-title-bar"></span>
              {{ group.label }}
            </div>
            <div class="permission-grid">
              <label
                v-for="permission in group.permissions"
                :key="permission.id"
                class="permission-item"
                :class="{ 'is-checked': permission.checked }"
              >
                <ElCheckbox
                  :model-value="permission.checked"
                  @update:model-value="(val) => togglePermission(permission, !!val)"
                  @click.stop
                />
                <span>{{ permission.name }}</span>
              </label>
            </div>
          </div>
        </template>

        <div v-else class="empty-permission">
          {{ t('role.noPermissionTip') }}
        </div>

        <div class="panel-footer">
          <span class="text-gray-500">
            {{ t('role.selectedPermissionCount', { count: selectedPermissionCount }) }}
          </span>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <BaseButton @click="emit('cancel')">{{ t('common.cancel') }}</BaseButton>
      <BaseButton type="primary" :loading="saveLoading" @click="emit('save')">
        {{ t('exampleDemo.save') }}
      </BaseButton>
    </div>
  </div>
</template>

<style scoped lang="less">
.assign-menu-permission {
  .role-info-card {
    padding: 20px 20px 4px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .permission-layout {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    min-height: 520px;
  }

  .permission-panel {
    display: flex;
    flex-direction: column;
    padding: 16px;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 8px;
  }

  .panel-header {
    margin-bottom: 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .menu-tree-wrap {
    flex: 1;
    min-height: 360px;
    overflow: auto;

    :deep(.el-tree-node__content) {
      .tree-node-content {
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: space-between;
        min-width: 0;
        padding-right: 8px;
      }

      .tree-node-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tree-node-permission-count {
        flex-shrink: 0;
        margin-left: 8px;
        font-size: 12px;
        font-weight: 600;
        color: var(--el-color-primary);
      }
    }
  }

  .panel-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    margin-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }

  .link-text {
    color: var(--el-color-primary);
    cursor: pointer;
  }

  .permission-tip {
    font-size: 13px;
    color: var(--el-text-color-secondary);
  }

  .permission-group + .permission-group {
    margin-top: 20px;
  }

  .group-title {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    font-size: 14px;
    font-weight: 600;
  }

  .group-title-bar {
    width: 3px;
    height: 14px;
    margin-right: 8px;
    background: var(--el-color-primary);
    border-radius: 2px;
  }

  .permission-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .permission-item {
    display: flex;
    gap: 8px;
    align-items: center;
    min-height: 30px;
    padding: 4px 8px;
    cursor: pointer;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    transition: all 0.2s;

    &.is-checked {
      background: var(--el-color-primary-light-9);
      border-color: var(--el-color-primary-light-5);
    }
  }

  .empty-permission {
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    color: var(--el-text-color-secondary);
  }

  .page-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
    padding-top: 20px;
    margin-top: 20px;
  }
}
</style>
