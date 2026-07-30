import { MessageType, NoticeLevel } from '@/prisma/generated/prisma/client'
import { RequiredPermission, User } from '@/processor/decorator'
import type { JwtUser } from '@/system/auth/dto/auth.dto'
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { createZodDto } from 'nestjs-zod/dto'
import { z } from 'zod'
import { MessageService } from './message.service'

const ListQuerySchema = z.object({
  pageIndex: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  type: z.nativeEnum(MessageType).optional(),
  unreadOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform(v => v === true || v === 'true' || v === '1'),
})
class ListQueryDto extends createZodDto(ListQuerySchema) {}

const SendMailSchema = z.object({
  receiverIds: z.array(z.string().min(1)).min(1),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  level: z.nativeEnum(NoticeLevel).optional(),
})
class SendMailDto extends createZodDto(SendMailSchema) {}

const SendSystemSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  level: z.nativeEnum(NoticeLevel).optional(),
})
class SendSystemDto extends createZodDto(SendSystemSchema) {}

const SendAlertSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(5000),
  level: z.nativeEnum(NoticeLevel).optional(),
})
class SendAlertDto extends createZodDto(SendAlertSchema) {}

const IdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
})
class IdsDto extends createZodDto(IdsSchema) {}

const ReceiversQuerySchema = z.object({
  keyword: z.string().max(50).optional(),
})
class ReceiversQueryDto extends createZodDto(ReceiversQuerySchema) {}

@ApiTags('消息通知')
@Controller('message')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Get('list')
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '我的消息列表' })
  list(@Query() query: ListQueryDto, @User() user: JwtUser) {
    return this.messageService.list(user.id, query)
  }

  @Get('receivers')
  @RequiredPermission('message:send')
  @ApiOperation({ summary: '获取站内信接收人列表' })
  receivers(@Query() query: ReceiversQueryDto, @User() user: JwtUser) {
    return this.messageService.searchReceivers(query.keyword, user.id)
  }

  @Get('unreadCount')
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '未读数量' })
  async unreadCount(@User() user: JwtUser) {
    const unread = await this.messageService.getUnreadCount(user.id)
    return { unread, message: 'ok' }
  }

  @Post('read')
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '标记已读' })
  markRead(@Body() body: IdsDto, @User() user: JwtUser) {
    return this.messageService.markRead(user.id, body.ids)
  }

  @Post('readAll')
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '全部已读' })
  markAllRead(@User() user: JwtUser) {
    return this.messageService.markAllRead(user.id)
  }

  @Delete()
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '删除消息' })
  remove(@Body() body: IdsDto, @User() user: JwtUser) {
    return this.messageService.remove(user.id, body.ids)
  }

  @Post('mail')
  @RequiredPermission('message:send')
  @ApiOperation({ summary: '发送站内信' })
  sendMail(@Body() body: SendMailDto, @User() user: JwtUser) {
    return this.messageService.enqueueMail({
      senderId: user.id,
      receiverIds: body.receiverIds,
      title: body.title,
      content: body.content,
      level: body.level,
    })
  }

  @Post('system')
  @RequiredPermission('message:send')
  @ApiOperation({ summary: '发送系统通知（全体用户）' })
  sendSystem(@Body() body: SendSystemDto, @User() user: JwtUser) {
    return this.messageService.enqueueSystem({
      senderId: user.id,
      title: body.title,
      content: body.content,
      level: body.level,
    })
  }

  @Post('alert')
  @RequiredPermission('message:send')
  @ApiOperation({ summary: '发送告警给超级管理员' })
  sendAlert(@Body() body: SendAlertDto) {
    return this.messageService.enqueueAlert({
      title: body.title,
      content: body.content,
      level: body.level,
    })
  }
}
