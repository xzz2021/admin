import { Prisma } from '@/prisma/generated/prisma/client'
import { PgService } from '@/prisma/pg.service'
import { RbacPermissionCacheService } from '@/processor/rbac'
import { formatDateToYMDHMS, hashPayPassword, verifyPayPassword } from '@/processor/utils'
import { RtTokenService } from '@/system/auth/rt.token.service'
import { TokenService } from '@/system/auth/token.service'
import { OnlineGateway } from '@/system/online/online.gateway'
import { OnlineService } from '@/system/online/online.service'
import { sanitizePathSegment } from '@/system/staticfile/multer.config'
import { RedisService } from '@liaoliaots/nestjs-redis'
import { BadRequestException, forwardRef, Inject, Injectable, Optional } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import {
  AdminUpdatePwdDto,
  CreateUserDto,
  QueryUserParams,
  UpdatePersonalInfo,
  UpdatePwdDto,
  UpdateUserDto,
} from './dto/user.dto'

@Injectable()
export class UserService {
  private readonly redis: Redis
  constructor(
    private readonly pgService: PgService,
    private readonly redisService: RedisService,
    private readonly rbacPermissionCache: RbacPermissionCacheService,
    private readonly tokenService: TokenService,
    private readonly rtTokenService: RtTokenService,
    private readonly configService: ConfigService,
    @Optional()
    @Inject(forwardRef(() => OnlineService))
    private readonly onlineService?: OnlineService,
    @Optional()
    @Inject(forwardRef(() => OnlineGateway))
    private readonly onlineGateway?: OnlineGateway,
  ) {
    this.redis = this.redisService.getOrThrow()
  }

  /** 改密 / 禁用：吊销全部会话并清理在线状态 */
  private async revokeAllSessions(userId: string) {
    if (this.onlineService) {
      const jtis = await this.onlineService.terminateUser(userId)
      this.onlineGateway?.notifyForceLogout(jtis, 'revoked')
      this.onlineGateway?.notifyForceLogoutByUser(userId, 'revoked')
      return
    }
    await Promise.all([this.tokenService.revokeAll(userId), this.rtTokenService.revokeAll(userId)])
  }

  findOne(phone: string) {
    return this.pgService.user.findUnique({
      where: {
        phone,
      },
    })
  }

  async getUsersOfDeptAndChildren(deptId: string) {
    const depts = await this.pgService.department.findMany({ select: { id: true, parentId: true } })
    const children = new Set<string>([deptId])
    let grew = true
    while (grew) {
      grew = false
      for (const d of depts) {
        if (d.parentId && children.has(d.parentId) && !children.has(d.id)) {
          children.add(d.id)
          grew = true
        }
      }
    }
    const deptIds = Array.from(children)
    return deptIds

    // return this.pgService.user.findMany({
    //   where: { departments: { some: { departmentId: { in: deptIds } } }, isDeleted: false, status: true },
    //   distinct: ['id'],
    // });
  }

  async findByDepartmentId(searchParam: QueryUserParams) {
    // 此处查询 只批量返回一般数据   查询效率会更好    详细数据应当通过单个ip去查询处理

    const { id, pageIndex, pageSize, enabled, ...rest } = searchParam
    const skip = (pageIndex - 1) * pageSize
    const take = pageSize
    // const newParams =
    // 遍历rest 构造 contains 对象
    const where = Object.entries(rest).reduce(
      (acc, [key, value]) => {
        if (value) {
          acc[key] = { contains: value }
        }
        return acc
      },
      {} as Record<string, any>,
    )
    where.enabled = enabled
    let deptIds: string[] = []
    if (id) {
      const rows = await this.pgService.$queryRaw<{ id: string }[]>`
        WITH RECURSIVE dept_tree AS (
          SELECT id, "parentId" FROM "Department" WHERE id = ${id}
          UNION ALL
          SELECT d.id, d."parentId"
          FROM "Department" d
          INNER JOIN dept_tree dt ON d."parentId" = dt.id
        )
        SELECT id FROM dept_tree;
      `
      deptIds = rows.map(row => row.id)
      where.departmentId = { in: deptIds }
    }
    //  同时查询 部门 角色 数据
    const newQueryParams = {
      where,
      select: {
        id: true,
        username: true,
        phone: true,
        avatar: true,
        enabled: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        roles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      // orderBy: { createdAt: 'asc' },
      skip: Number(skip),
      take: Number(take),
    }

    const rawlist = await this.pgService.user.findMany({
      ...newQueryParams,
      distinct: ['id'],
    })

    const list = rawlist.map(u => ({
      ...u,
      createdAt: formatDateToYMDHMS(u.createdAt),
      roles: u.roles.map(r => r.role.id), // 把 { role: {...} } 提取成 {...}
    }))

    const total = await this.pgService.user.count({ where })

    return { list, total, message: '部门用户列表查询成功' }
  }

  async addUser(addUserinfoDto: CreateUserDto) {
    const { department, roles, phone, username, password: rawPassword } = addUserinfoDto
    // 1. 查询手机号 是否存在,  存在抛出异常提示
    const isExit = await this.pgService.user.findFirst({ where: { phone } })
    if (isExit?.id && phone) {
      // return { code: 400, message: '手机号已存在,无法添加!' };
      throw new BadRequestException('手机号已存在,无法添加!')
    }
    const password = await hashPayPassword(rawPassword)
    return await this.pgService.$transaction(async tx => {
      const userSave = await tx.user.create({
        data: {
          username,
          password,
          phone: phone,
          department: {
            connect: { id: department },
          },
          roles: {
            create: roles?.map(id => ({ role: { connect: { id } } })),
          },
        },
      })

      return { code: 200, message: '新增用户成功', id: userSave.id }
    })
  }

  async update(updateUserinfoDto: UpdateUserDto) {
    const { id, department, roles, ...rest } = updateUserinfoDto
    const res = await this.pgService.user.update({
      where: { id },
      data: {
        ...rest,
        department: {
          connect: { id: department },
        },
        roles: {
          deleteMany: {}, // 清空所有旧关联
          create: roles?.map(id => ({ role: { connect: { id } } })),
        },
      },
    })
    await this.rbacPermissionCache.invalidateUsers([id])
    if (rest.enabled === false) {
      await this.revokeAllSessions(id)
    }
    return { message: '更新用户信息成功', id: res.id }
  }

  async batchDeleteUser(ids: string[]) {
    //  使用事务 删除用户 同时删除用户角色及部门关联数据
    await this.pgService.$transaction(async tx => {
      await tx.userRole.deleteMany({ where: { userId: { in: ids } } })
      await tx.userSession.deleteMany({ where: { userId: { in: ids } } })
      await tx.user.deleteMany({ where: { id: { in: ids } } })
    })
    await this.rbacPermissionCache.invalidateUsers(ids)
    await Promise.all(ids.map(id => this.revokeAllSessions(id)))
    return { message: '删除用户成功', count: ids.length }
  }

  async getUserInfo(userId: string) {
    const userinfo = await this.pgService.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        avatar: true,
        username: true,
        phone: true,
        email: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    })
    return { userinfo, message: '获取个人信息成功' }
  }
  async updateInfo(updateUserinfoDto: UpdatePersonalInfo) {
    // 用户更新自己的 一般信息
    const { id, ...updateData } = updateUserinfoDto
    const res = await this.pgService.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
      },
    })
    return { message: '更新个人信息成功', id: res.id }
  }

  async updatePassword(updatePasswordDto: UpdatePwdDto) {
    const { id, password, newPassword } = updatePasswordDto
    const user = await this.pgService.user.findUnique({
      where: { id },
      select: {
        id: true,
        password: true,
      },
    })
    if (!user) {
      throw new BadRequestException('用户不存在')
    }
    const isMatch = await verifyPayPassword(user.password, password)
    if (!isMatch) {
      throw new BadRequestException('修改失败, 旧密码不正确')
    }
    const hashPassword = await hashPayPassword(newPassword)
    const res = await this.pgService.user.update({
      where: { id },
      data: { password: hashPassword, passwordChangedAt: new Date() },
    })
    await this.revokeAllSessions(id)
    return { code: 200, message: '更新个人密码成功', id: res.id }
  }

  async resetPassword({ id, password, operateId }: AdminUpdatePwdDto & { operateId: string }) {
    // console.log('xzz2021: UserService -> resetPassword -> operateId', operateId);
    // 此处需要自定义 校验操作人是否 有执行权限
    // const isAdmin = await this.pgService.user.findUnique({ where: { id: operateId } });
    // if (!isAdmin) return { code: 400, message: '没有权限' };

    const hashPassword = await hashPayPassword(password)
    const res = await this.pgService.user.update({
      where: { id },
      data: { password: hashPassword, passwordChangedAt: new Date() },
    })
    await this.revokeAllSessions(id)
    return { message: '重置用户密码成功', id: res.id }
  }

  // //  校验短信 或邮箱 验证码
  // async checkSmsCode(smskey: string, code: string, type: 'sms' | 'email' = 'sms') {
  //   try {
  //     const cacheCode = await this.redis.get(type + '_' + smskey);
  //     if (!cacheCode) {
  //       return { status: false, code: 400, message: '验证码已过期, 请重新获取!' };
  //     }
  //     if (cacheCode != code) {
  //       return { status: false, code: 400, message: '验证码错误, 请重新输入!' };
  //     }
  //     await this.redis.del(type + '_' + smskey);
  //     return { status: true, code: 200, message: '验证码正确' };
  //   } catch (error) {
  //     console.log('🚀 ~ AuthService ~ checkSmsCode ~ error:', error);
  //     return { status: false, code: 400, message: '验证码校验错误, 请稍候重试!' };
  //   }
  // }

  async findAll(searchParam: QueryUserParams) {
    // 此处查询 只批量返回一般数据   查询效率会更好    详细数据应当通过单个ip去查询处理
    const { pageIndex, pageSize, username, phone, enabled, id } = searchParam
    const skip = (pageIndex - 1) * pageSize
    const take = pageSize
    const where: Prisma.UserWhereInput = {}

    if (username) {
      where.username = { contains: username }
    }
    if (phone) {
      where.phone = { contains: phone }
    }
    if (enabled !== undefined) {
      where.enabled = enabled
    }
    if (id) {
      where.departmentId = id
    }

    const list = await this.pgService.user.findMany({
      where,
      skip,
      take,
      orderBy: { id: 'desc' },
      omit: {
        password: true,
      },
    })
    const total = await this.pgService.user.count({ where })
    return { list, total, message: '获取用户列表成功' }
  }

  async uploadAvatar(file: Express.Multer.File, userId: string, phone?: string | null) {
    if (!file) {
      throw new BadRequestException('文件不存在')
    }
    if (!userId) {
      throw new BadRequestException('身份识别异常')
    }
    const serveRoot = this.configService.get<string>('staticFileServeRoot') || ''
    const phoneSegment = sanitizePathSegment(phone ?? 'anonymous')
    const filePath = `${serveRoot}/avatar/${phoneSegment}/${file.filename}`
    await this.pgService.user.update({ where: { id: userId }, data: { avatar: filePath } })
    return { filePath, message: '更新头像成功' }
  }
}
