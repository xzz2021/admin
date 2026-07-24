import { RequiredPermission } from '@/processor/decorator'
import type { JwtReqDto } from '@/system/auth/dto/auth.dto'
import { multerConfigForAvatar } from '@/system/staticfile/multer.config'
import { BadRequestException, Body, Controller, Delete, Get, Post, Query, Req, UploadedFile, UseInterceptors } from '@nestjs/common'
// import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger'
import {
  AdminUpdatePwdDto,
  BatchDeleteUserDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePersonalInfo,
  UpdatePwdDto,
  UpdateUserDto,
  UserListRes,
} from './dto/user.dto'
import { UserService } from './user.service'
@ApiTags('用户')
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    // private readonly configService: ConfigService,
  ) {}

  @Get('listByDepartmentId')
  @RequiredPermission('user:view')
  @ApiOperation({ summary: '获取指定部门用户, 包含角色和部门id数组, 用于分配角色和部门' })
  @ApiResponse({ type: UserListRes })
  findBy(@Query() params: QueryUserParams) {
    return this.userService.findByDepartmentId(params)
  }

  @Get('detailInfo')
  @ApiOperation({ summary: '获取用户详情信息' })
  // @ApiResponse({ type: UpdateUserDto })
  detailInfo(@Req() req: JwtReqDto) {
    const userId = req.user.id
    return this.userService.getUserInfo(userId)
  }

  @Post('updatePersonalInfo')
  @ApiOperation({ summary: '用户更新自己的个人信息' })
  updatePersonalInfo(@Body() updateUserinfo: UpdatePersonalInfo, @Req() req: JwtReqDto) {
    // 用户更新自己的信息  校验req.user
    if (req.user.id !== updateUserinfo.id) {
      return { code: 400, message: '无权限更新他人信息' }
    }
    return this.userService.updateInfo(updateUserinfo)
  }

  @Post('updatePassword')
  @ApiOperation({ summary: '用户更新自己的密码' })
  updatePassword(@Body() updatePasswordDto: UpdatePwdDto, @Req() req: JwtReqDto) {
    // 用户更新自己的密码  校验req.user
    if (req.user.id !== updatePasswordDto.id) {
      return { code: 400, message: '无权限更新他人密码' }
    }
    return this.userService.updatePassword(updatePasswordDto)
  }

  // 管理员重置用户密码
  @Post('resetPassword')
  @RequiredPermission('user:update')
  @ApiOperation({ summary: '管理员重置用户密码' })
  resetPassword(@Body() updatePasswordDto: AdminUpdatePwdDto, @Req() req: JwtReqDto) {
    const operateId = req.user.id
    if (!operateId) throw new BadRequestException('身份识别异常,没有权限')
    const { id, password } = updatePasswordDto
    if (!id || !password) throw new BadRequestException('参数异常')
    return this.userService.resetPassword({ id, password, operateId })
  }

  @Post('add')
  @RequiredPermission('user:add')
  @ApiOperation({ summary: '创建用户' })
  addUser(@Body() addUserinfoDto: CreateUserDto) {
    return this.userService.addUser(addUserinfoDto)
  }

  @Post('update')
  @RequiredPermission('user:update')
  @ApiOperation({ summary: '更新用户' })
  update(@Body() updateData: UpdateUserDto) {
    return this.userService.update(updateData)
  }

  @Delete('delete')
  @RequiredPermission('user:delete')
  @ApiOperation({ summary: '批量删除用户' })
  delete(@Body() deleteUserData: BatchDeleteUserDto) {
    return this.userService.batchDeleteUser(deleteUserData.ids)
  }

  @Get('list')
  @RequiredPermission('user:view')
  @ApiOperation({ summary: '按条件获取所有用户' })
  allList(@Query() params: QueryUserParams) {
    return this.userService.findAll(params)
  }

  @Post('upload/avatar')
  @UseInterceptors(FileInterceptor('file', multerConfigForAvatar))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: JwtReqDto) {
    if (!file) {
      throw new BadRequestException('文件不存在')
    }
    const userId = req.user.id
    const phone = req.user.phone ?? ''
    return this.userService.uploadAvatar(file, userId, phone)
  }
}
