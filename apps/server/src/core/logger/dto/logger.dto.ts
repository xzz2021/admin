import { UserOperationLogModel } from '@prisma/generated/zod';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const LogSchema = UserOperationLogModel.pick({
  id: true,
  ip: true,
  userAgent: true,
  method: true,
  requestUrl: true,
  isSuccess: true,
  responseMsg: true,
  detailInfo: true,
  duration: true,
});
export class LogDto extends createZodDto(LogSchema) {}

const QueryLogParamsSchema = z.object({
  pageIndex: z.coerce.number().int().min(1).optional().default(1).meta({ description: '页码', example: 1 }),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(10).meta({ description: '每页条数', example: 10 }),
  isSuccess: z.boolean().optional().meta({ description: '状态' }),
  method: z.string().optional().meta({ description: '方法' }),
  requestUrl: z.string().optional().meta({ description: '请求URL' }),
  dateRange: z.string().optional().meta({ description: '日期范围' }),
});
export class QueryLogParams extends createZodDto(QueryLogParamsSchema) {}

const DeleteLogSchema = z.object({
  ids: z
    .array(z.number().int())
    .nonempty()
    .transform(val => [...new Set(val)])
    .meta({ description: '日志ID数组', example: [1, 2, 3] }),
});
export class DeleteLogDto extends createZodDto(DeleteLogSchema) {}

const LogListResSchema = LogSchema.extend({
  createdAt: z.string(),
  // createdAt: z.coerce.date().transform((val: Date) => formatDateToYMDHMS(val)),
});
export class LogListResDto extends createZodDto(LogListResSchema) {}
