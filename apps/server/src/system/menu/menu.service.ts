import { Prisma } from '@/prisma/generated/prisma/client'
import { uniqueBy } from '@/processor/utils/array'
import { listToTree } from '@/processor/utils/list2tree.util'
import { assertAcyclicParent } from '@/processor/utils/tree-cycle'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateMenuDto, MenuSortDto, UpdateMenuDto } from './dto/menu.dto'
import { MenuRepository } from './menu.repository'

@Injectable()
export class MenuService {
  constructor(private readonly menus: MenuRepository) {}

  async create(createMenuDto: CreateMenuDto) {
    const { parentId, ...rest } = createMenuDto
    const res = await this.menus.create({
      ...rest,
      parent: {
        connect: parentId ? { id: parentId } : undefined,
      },
    })

    return { id: res.id, message: '创建菜单成功' }
  }

  async update(updateMenuDto: UpdateMenuDto) {
    const { id, parentId, ...rest } = updateMenuDto
    const res = await this.menus.transaction(async tx => {
      const links = await this.menus.findTreeLinks(tx)
      const current = links.find(item => item.id === id)
      if (!current) throw new NotFoundException('菜单不存在')

      const nextParentId = parentId === undefined ? current.parentId : parentId
      assertAcyclicParent(links, id, nextParentId, '菜单')

      const data: Prisma.MenuUpdateInput = {
        ...rest,
        ...(parentId === undefined
          ? {}
          : parentId === null
            ? { parent: { disconnect: true } }
            : { parent: { connect: { id: parentId } } }),
      }
      return this.menus.updateById(id, data, tx)
    })

    return { id: res?.id, message: '更新菜单成功' }
  }

  /**
   * 删除菜单（仅允许删除无子菜单的节点）。
   * Permission / RoleMenu / RolePermission 由数据库外键级联删除。
   */
  async remove(id: string) {
    const menu = await this.menus.findById(id)
    if (!menu) {
      throw new NotFoundException('菜单不存在')
    }

    const childCount = await this.menus.countChildren(id)
    if (childCount > 0) {
      throw new BadRequestException('该菜单存在子菜单，请先删除子菜单')
    }

    await this.menus.deleteById(id)
    return { id, message: '删除菜单成功' }
  }

  async findMenuList() {
    const menus = await this.menus.findAllWithPermissions()
    const list = listToTree(menus)
    return { list, message: '获取菜单成功' }
  }

  async sortMenu(sortMenu: MenuSortDto[]) {
    const rows = uniqueBy(sortMenu, item => item.id).map(item => ({
      id: item.id,
      value: item.sort ?? 0,
    }))
    if (rows.length === 0) return { message: '菜单排序成功' }

    await this.menus.updateSorts(rows)
    return { message: '菜单排序成功' }
  }
}
