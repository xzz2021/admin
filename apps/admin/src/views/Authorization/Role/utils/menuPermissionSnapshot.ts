import { eachTree } from '@/utils/tree'

export const ROLE_MENU_PERMISSION_SNAPSHOT_TYPE = 'role-menu-permission' as const
export const ROLE_MENU_PERMISSION_SNAPSHOT_VERSION = 1 as const

export interface RoleMenuPermissionSnapshotItem {
  id: string
  permissionIds: string[]
}

export interface RoleMenuPermissionSnapshot {
  type: typeof ROLE_MENU_PERMISSION_SNAPSHOT_TYPE
  version: typeof ROLE_MENU_PERMISSION_SNAPSHOT_VERSION
  menus: RoleMenuPermissionSnapshotItem[]
}

interface SnapshotPermission {
  id: string
  checked?: boolean
}

interface SnapshotMenuNode {
  id: string
  checked?: boolean
  permissions?: SnapshotPermission[]
  children?: SnapshotMenuNode[]
}

export const buildRoleMenuPermissionSnapshot = (menuTree: SnapshotMenuNode[]): RoleMenuPermissionSnapshot => {
  const menus: RoleMenuPermissionSnapshotItem[] = []

  eachTree(menuTree, (node) => {
    if (!node.checked) return
    menus.push({
      id: node.id,
      permissionIds: node.permissions?.filter((item) => item.checked).map((item) => item.id) || []
    })
  })

  return {
    type: ROLE_MENU_PERMISSION_SNAPSHOT_TYPE,
    version: ROLE_MENU_PERMISSION_SNAPSHOT_VERSION,
    menus
  }
}

export const parseRoleMenuPermissionSnapshot = (raw: string): RoleMenuPermissionSnapshot | null => {
  try {
    const data = JSON.parse(raw) as Partial<RoleMenuPermissionSnapshot>
    if (data?.type !== ROLE_MENU_PERMISSION_SNAPSHOT_TYPE) return null
    if (data?.version !== ROLE_MENU_PERMISSION_SNAPSHOT_VERSION) return null
    if (!Array.isArray(data.menus)) return null

    const menus = data.menus
      .filter((item): item is RoleMenuPermissionSnapshotItem => !!item && typeof item.id === 'string')
      .map((item) => ({
        id: item.id,
        permissionIds: Array.isArray(item.permissionIds)
          ? item.permissionIds.filter((id): id is string => typeof id === 'string')
          : []
      }))

    return {
      type: ROLE_MENU_PERMISSION_SNAPSHOT_TYPE,
      version: ROLE_MENU_PERMISSION_SNAPSHOT_VERSION,
      menus
    }
  } catch {
    return null
  }
}

export interface ApplySnapshotResult {
  matchedMenuCount: number
  matchedPermissionCount: number
}

export const applyRoleMenuPermissionSnapshot = (
  menuTree: SnapshotMenuNode[],
  snapshot: RoleMenuPermissionSnapshot
): ApplySnapshotResult => {
  const menuMap = new Map(snapshot.menus.map((item) => [item.id, new Set(item.permissionIds)]))
  let matchedMenuCount = 0
  let matchedPermissionCount = 0

  eachTree(menuTree, (node) => {
    const permissionIds = menuMap.get(node.id)
    const checked = !!permissionIds
    node.checked = checked

    if (checked) matchedMenuCount++

    node.permissions?.forEach((permission) => {
      const permissionChecked = checked && !!permissionIds?.has(permission.id)
      permission.checked = permissionChecked
      if (permissionChecked) matchedPermissionCount++
    })
  })

  return { matchedMenuCount, matchedPermissionCount }
}
