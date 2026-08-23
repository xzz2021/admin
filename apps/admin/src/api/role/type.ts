export interface RoleItem {
  id: string
  name: string
  code: string
  enabled: boolean
  sort: number
  description?: string
  isSystem?: boolean
  createdAt: string
  updatedAt: string
}

export interface RoleDetail extends RoleItem {
  creatorName?: string
  menuCount: number
  permissionCount: number
  userCount: number
}

export interface RoleMenuPayload {
  id: string
  permissionIds: string[]
}

export interface RoleSubmitPayload {
  code: string
  name: string
  enabled: boolean
  description: string
  menus: RoleMenuPayload[]
}

export interface RoleUpdatePayload extends RoleSubmitPayload {
  id: string
}
