import { RequiredPermission, Serialize } from '@/processor/decorator'
import { clientIp } from '@/processor/utils'
import type { JwtReqDto } from '@/system/auth/dto/auth.dto'
import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import { DepartmentService } from './department.service'
import {
  CreateDepartmentDto,
  DeleteDepartmentDto,
  DepartmentListResDto,
  DepartmentSeedArrayDto,
  UpdateDepartmentDto,
} from './dto/department.dto'

@ApiTags('部门')
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('add')
  @RequiredPermission('department:add')
  @ApiOperation({ summary: '添加部门' })
  add(@Body() createDepartmentDto: CreateDepartmentDto, @Req() req: JwtReqDto) {
    return this.departmentService.add(createDepartmentDto, req.user.id, clientIp(req.ip))
  }

  @Get('list')
  @RequiredPermission('department:view')
  @ApiOperation({ summary: '获取部门列表' })
  @Serialize(DepartmentListResDto)
  @ApiResponse({ type: DepartmentListResDto, isArray: true })
  findAll() {
    return this.departmentService.findAll()
  }

  @Post('update')
  @RequiredPermission('department:update')
  @ApiOperation({ summary: '更新部门' })
  update(@Body() updateDepartmentDto: UpdateDepartmentDto, @Req() req: JwtReqDto) {
    return this.departmentService.update(updateDepartmentDto, req.user.id, clientIp(req.ip))
  }

  @Delete('delete')
  @RequiredPermission('department:delete')
  @ApiOperation({ summary: '删除部门', description: '删除部门详细说明' })
  delete(@Body() body: DeleteDepartmentDto, @Req() req: JwtReqDto) {
    return this.departmentService.delete(body.id, req.user.id, clientIp(req.ip))
  }

  @Post('generateDepartmentSeed')
  @RequiredPermission('department:seed')
  @ApiOperation({ summary: '生成部门种子数据' })
  generateDepartmentSeed(@Body() data: DepartmentSeedArrayDto) {
    return this.departmentService.generateDepartmentSeed(data.data ?? [])
  }
}
