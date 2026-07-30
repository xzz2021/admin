import { RequiredPermission, User } from '@/processor/decorator'
import type { JwtUser } from '@/system/auth/dto/auth.dto'
import { Body, Controller, Delete, Get, Post, Query } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { IdsDto, ListQueryDto } from './dto/message.dto'
import { MessageService } from './message.service'

@ApiTags('消息收件箱')
@Controller('message')
export class MessageInboxController {
  constructor(private readonly messageService: MessageService) {}

  @Get('list')
  @RequiredPermission('message:view')
  @ApiOperation({ summary: '我的消息列表' })
  list(@Query() query: ListQueryDto, @User() user: JwtUser) {
    return this.messageService.list(user.id, query)
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
}
