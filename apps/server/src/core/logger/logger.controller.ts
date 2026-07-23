import { RequiredPermission, Serialize } from '@/processor/decorator';
import { Body, Controller, Delete, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteLogDto, LogListResDto, QueryLogParams } from './dto/logger.dto';
import { LogService } from './logger.service';

@ApiTags('日志')
@Controller('log')
export class LoggerController {
  constructor(private readonly loggerService: LogService) {}

  @Get('getUserOperationLogList')
  @RequiredPermission('userLog:view')
  @ApiOperation({ summary: '获取用户操作日志列表' })
  @Serialize(LogListResDto)
  @ApiResponse({ type: LogListResDto, isArray: true })
  getUserOperationLogList(@Query() params: QueryLogParams) {
    //  启用缓存后   相同请求 会直接跳过这里的控制器
    // console.log('xzz2021: UtilController -> logList -> joinQueryParams', joinQueryParams);
    return this.loggerService.getUserOperationLogList(params);
  }

  @Delete('deleteUserOperationLog')
  @RequiredPermission('userLog:delete')
  @ApiOperation({ summary: '删除用户操作日志' })
  deleteUserOperationLog(@Body() obj: DeleteLogDto) {
    return this.loggerService.deleteUserOperationLog(obj);
  }
}
