export interface RoleFormModel {
  id?: string
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

export interface RoleMenuPermissionItem {
  id: string
  name: string
  code: string
  type?: string
  checked?: boolean
}

export interface RoleMenuTreeNode {
  id: string
  title: string
  checked?: boolean
  permissions?: RoleMenuPermissionItem[]
  children?: RoleMenuTreeNode[]
}

export const ROLE_PERMISSION_TYPE_I18N: Record<string, string> = {
  BUTTON: 'role.permissionTypeButton',
  DATA: 'role.permissionTypeData',
  API: 'role.permissionTypeApi',
  OTHER: 'role.permissionTypeOther'
}

export const filterRoleMenuNode = (value: string, data: RoleMenuTreeNode) => {
  if (!value) return true
  return data.title?.toLowerCase().includes(value.toLowerCase())
}

export const findFirstMenuNode = (tree: RoleMenuTreeNode[]): RoleMenuTreeNode | undefined => {
  for (const node of tree) {
    if (node.permissions?.length) return node
    if (node.children?.length) {
      const found = findFirstMenuNode(node.children)
      if (found) return found
    }
  }
  return tree[0]
}

export const getMenuPermissionCount = (node: RoleMenuTreeNode) => {
  const total = node.permissions?.length ?? 0
  const selected = node.permissions?.filter((permission) => permission.checked).length ?? 0
  return { selected, total }
}

export const groupPermissionsByType = (permissions: RoleMenuPermissionItem[]) => {
  const groups = new Map<string, RoleMenuPermissionItem[]>()
  for (const permission of permissions) {
    const type = permission.type || 'OTHER'
    const list = groups.get(type) || []
    list.push(permission)
    groups.set(type, list)
  }
  return Array.from(groups.entries()).map(([type, items]) => ({ type, permissions: items }))
}

export const collectRoleSubmitData = (form: RoleFormModel, tree: RoleMenuTreeNode[]): RoleSubmitData => {
  const menus: RoleSubmitData['menus'] = []
  const walk = (nodes: RoleMenuTreeNode[]) => {
    for (const node of nodes) {
      if (node.checked) {
        menus.push({
          id: node.id,
          permissionIds: node.permissions?.filter((item) => item.checked).map((item) => item.id) || []
        })
      }
      if (node.children?.length) walk(node.children)
    }
  }
  walk(tree)
  return {
    code: form.code,
    name: form.name,
    enabled: form.enabled,
    description: form.description || '',
    menus
  }
}
