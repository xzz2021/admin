import { RequiredPermission } from '@/processor/decorator'
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { CreateMenuDto, MenuListRes, MenuSortArrayDto, UpdateMenuDto } from './dto/menu.dto'
import { MenuService } from './menu.service'

@ApiTags('菜单')
@Controller('menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post('add')
  @RequiredPermission('menu:add')
  @ApiOperation({ summary: '创建菜单' })
  create(@Body() createMenuDto: CreateMenuDto) {
    return this.menuService.create(createMenuDto)
  }

  @Post('update')
  @RequiredPermission('menu:update')
  @ApiOperation({ summary: '更新菜单' })
  update(@Body() createMenuDto: UpdateMenuDto) {
    return this.menuService.update(createMenuDto)
  }

  @Get('getMenuList')
  @RequiredPermission('menu:view')
  @ApiOperation({ summary: '获取所有菜单嵌套列表, 包含权限, 用于展示管理' })
  @ApiResponse({ type: MenuListRes, isArray: true })
  getMenuList() {
    return this.menuService.findMenuList()
  }

  @Delete(':id')
  @RequiredPermission('menu:delete')
  @ApiOperation({ summary: '删除菜单' })
  remove(@Param('id') id: string) {
    return this.menuService.remove(id)
  }

  @Post('sort')
  @RequiredPermission('menu:update')
  @ApiOperation({ summary: '排序菜单' })
  sort(@Body() data: MenuSortArrayDto) {
    return this.menuService.sortMenu(data.data)
  }
}
