import { RequiredPermission, Serialize } from '@/processor/decorator';
import { Body, Controller, Delete, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import {
  CreateDepartmentDto,
  DeleteDepartmentDto,
  DepartmentListDto,
  DepartmentListResDto,
  DepartmentSeedArrayDto,
  UpdateDepartmentDto,
} from './dto/department.dto';

@ApiTags('部门')
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post('add')
  @RequiredPermission('department:add')
  @ApiOperation({ summary: '添加部门' })
  add(@Body() createDepartmentDto: CreateDepartmentDto) {
    return this.departmentService.add(createDepartmentDto);
  }

  @Get('list')
  @RequiredPermission('department:view')
  @ApiOperation({ summary: '获取部门列表' })
  @Serialize(DepartmentListResDto)
  @ApiResponse({ type: DepartmentListDto, isArray: true })
  findAll() {
    return this.departmentService.findAll();
  }

  @Post('update')
  @RequiredPermission('department:update')
  @ApiOperation({ summary: '更新部门' })
  update(@Body() updateDepartmentDto: UpdateDepartmentDto) {
    return this.departmentService.update(updateDepartmentDto);
  }

  @Delete('delete')
  @RequiredPermission('department:delete')
  @ApiOperation({ summary: '删除部门', description: '删除部门详细说明' })
  delete(@Body() body: DeleteDepartmentDto) {
    return this.departmentService.delete(body.id);
  }

  @Post('generateDepartmentSeed')
  @RequiredPermission('department:seed')
  @ApiOperation({ summary: '生成部门种子数据' })
  generateDepartmentSeed(@Body() data: DepartmentSeedArrayDto) {
    return this.departmentService.generateDepartmentSeed(data.data ?? []);
  }
}
