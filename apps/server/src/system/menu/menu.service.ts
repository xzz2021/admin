import { PgService } from '@/prisma/pg.service'
import { listToTree } from '@/processor/utils/list2tree.util'
import { assertAcyclicParent } from '@/processor/utils/tree-cycle'
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CreateMenuDto, MenuSortDto, UpdateMenuDto } from './dto/menu.dto'

@Injectable()
export class MenuService {
  constructor(private readonly pgService: PgService) {}

  async create(createMenuDto: CreateMenuDto) {
    const { parentId, ...rest } = createMenuDto
    const createStatement = {
      data: {
        ...rest,
        parent: {
          connect: parentId ? { id: parentId } : undefined,
        },
      },
      select: { id: true },
    }

    const res = await this.pgService.menu.create(createStatement)

    return { id: res.id, message: '创建菜单成功' }
  }

  async update(updateMenuDto: UpdateMenuDto) {
    const { id, parentId, ...rest } = updateMenuDto
    const res = await this.pgService.$transaction(async tx => {
      const links = await tx.menu.findMany({
        select: { id: true, parentId: true },
      })
      const current = links.find(item => item.id === id)
      if (!current) throw new NotFoundException('菜单不存在')

      const nextParentId = parentId === undefined ? current.parentId : parentId
      assertAcyclicParent(links, id, nextParentId, '菜单')

      return tx.menu.update({
        where: { id },
        data: {
          ...rest,
          ...(parentId === undefined
            ? {}
            : parentId === null
              ? { parent: { disconnect: true } }
              : { parent: { connect: { id: parentId } } }),
        },
        select: { id: true },
      })
    })

    return { id: res?.id, message: '更新菜单成功' }
  }

  /**
   * 删除菜单（仅允许删除无子菜单的节点）。
   * Permission / RoleMenu / RolePermission 由数据库外键级联删除。
   */
  async remove(id: string) {
    const menu = await this.pgService.menu.findUnique({
      where: { id },
      select: { id: true },
    })
    if (!menu) {
      throw new NotFoundException('菜单不存在')
    }

    const childCount = await this.pgService.menu.count({
      where: { parentId: id },
    })
    if (childCount > 0) {
      throw new BadRequestException('该菜单存在子菜单，请先删除子菜单')
    }

    await this.pgService.menu.delete({
      where: { id },
      select: { id: true },
    })

    return { id, message: '删除菜单成功' }
  }

  // 获取全部菜单（含 permissions），再组装为多层树
  async findMenuList() {
    const menus = await this.pgService.menu.findMany({
      orderBy: [{ sort: 'asc' }],
      include: {
        permissions: { orderBy: { sort: 'asc' } },
      },
    })
    const list = listToTree(menus)
    return { list, message: '获取菜单成功' }
  }

  async sortMenu(sortMenu: MenuSortDto[]) {
    await this.pgService.$transaction(async tx => {
      for (const item of sortMenu) {
        await tx.menu.update({
          where: { id: item.id },
          data: { sort: item.sort },
        })
      }
    })
    return { message: '菜单排序成功' }
  }
}
