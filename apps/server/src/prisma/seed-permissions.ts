import type { Prisma } from './generated/prisma/client'
import { MenuType, PermissionType } from './generated/prisma/enums'

export interface PermissionSeedItem {
  name: string
  code: string
  resource: string
  type: keyof typeof PERMISSION_TYPE_MAP
  scopeEnabled?: boolean
}

const PERMISSION_TYPE_MAP = {
  button: PermissionType.BUTTON,
  data: PermissionType.DATA,
  api: PermissionType.API,
  other: PermissionType.OTHER,
} as const

//  这里后续可以替换成任意新菜单数据
export const CUSTOMER_MENU = {
  name: 'Customer',
  path: 'customer',
  redirect: null,
  type: MenuType.MENU,
  component: 'views/Customer/Customer',
  sort: 2,
  enabled: true,
  title: 'router.customer',
  icon: 'contact',
  hidden: false,
  affix: false,
  activeMenu: null,
  alwaysShow: false,
  breadcrumb: true,
  canTo: false,
  noCache: false,
  noTagsView: false,
}

/*
 loadMenuIdsByResource此函数很厉害
 uniquePaths通过去重,避免了重复数据, uniquePaths.includes(CUSTOMER_MENU.path) 和 menuIds.has(CUSTOMER_MENU.path) 双重保险   加上upsert 三重
*/
async function loadMenuIdsByResource(
  resources: readonly string[],
  tx: Prisma.TransactionClient,
): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(resources)]
  const menus = await tx.menu.findMany({
    where: { path: { in: uniquePaths } },
    select: { id: true, path: true },
  })
  const menuIds = new Map(menus.map(menu => [menu.path, menu.id]))

  if (uniquePaths.includes(CUSTOMER_MENU.path) && !menuIds.has(CUSTOMER_MENU.path)) {
    const created = await tx.menu.upsert({
      where: { path: CUSTOMER_MENU.path },
      update: {
        name: CUSTOMER_MENU.name,
        component: CUSTOMER_MENU.component,
        title: CUSTOMER_MENU.title,
        type: CUSTOMER_MENU.type,
        enabled: CUSTOMER_MENU.enabled,
        icon: CUSTOMER_MENU.icon,
        sort: CUSTOMER_MENU.sort,
        hidden: CUSTOMER_MENU.hidden,
        affix: CUSTOMER_MENU.affix,
        alwaysShow: CUSTOMER_MENU.alwaysShow,
        breadcrumb: CUSTOMER_MENU.breadcrumb,
        canTo: CUSTOMER_MENU.canTo,
        noCache: CUSTOMER_MENU.noCache,
        noTagsView: CUSTOMER_MENU.noTagsView,
      },
      create: CUSTOMER_MENU,
      select: { id: true },
    })
    menuIds.set(CUSTOMER_MENU.path, created.id)
  }

  const missing = uniquePaths.find(path => !menuIds.has(path))
  if (missing) {
    throw new Error(`Menu ${missing} not found`)
  }
  return menuIds
}

// 按 code 唯一键 upsert：不含 id，有则更新名称/类型/菜单/资源字段，无则创建
export async function create_additional_permissions(
  permission_data: readonly PermissionSeedItem[],
  tx: Prisma.TransactionClient,
) {
  const menuIds = await loadMenuIdsByResource(
    permission_data.map(item => item.resource),
    tx,
  )
  for (const permission_item of permission_data) {
    const { resource, code, name, type, scopeEnabled = false } = permission_item
    const menuId = menuIds.get(resource)
    if (!menuId) {
      throw new Error(`Menu ${resource} not found`)
    }
    const permissionCode = `${resource}:${code}`
    await tx.permission.upsert({
      where: { code: permissionCode },
      update: {
        name,
        menuId,
        type: PERMISSION_TYPE_MAP[type],
        resource,
        action: code,
        scopeEnabled,
      },
      create: {
        name,
        code: permissionCode,
        menuId,
        type: PERMISSION_TYPE_MAP[type],
        resource,
        action: code,
        scopeEnabled,
      },
    })
  }
}
