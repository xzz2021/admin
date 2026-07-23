export type PermissionType = 'BUTTON' | 'DATA' | 'API' | 'OTHER'

export interface MenuPermission {
  id?: string
  name: string
  code: string
  type: PermissionType
  sort?: number
  enabled?: boolean
  menuId?: string
}

export interface MenuItem {
  id?: string
  parentId?: string | null
  type: number
  name: string
  path: string
  component?: string | null
  redirect?: string | null
  title: string
  enabled?: boolean
  sort?: number
  icon?: string | null
  affix?: boolean
  activeMenu?: string | null
  alwaysShow?: boolean
  breadcrumb?: boolean
  canTo?: boolean
  hidden?: boolean
  noCache?: boolean
  noTagsView?: boolean
  external?: boolean
  link?: string | null
  keepAlive?: boolean
  permissions?: MenuPermission[]
  children?: MenuItem[]
  createdAt?: string
  updatedAt?: string
}

export type CreateMenuDto = Omit<MenuItem, 'id' | 'permissions' | 'children' | 'createdAt' | 'updatedAt'>

export type UpdateMenuDto = CreateMenuDto & { id: string }

export interface CreatePermissionDto {
  name: string
  code: string
  type: PermissionType
  menuId: string
  sort?: number
  enabled?: boolean
}

export interface UpdatePermissionDto {
  id: string
  name: string
  code: string
  type: PermissionType
  sort?: number
  enabled?: boolean
}
