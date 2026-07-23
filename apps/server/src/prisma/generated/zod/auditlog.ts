import * as z from 'zod';
import { createZodDto } from 'nestjs-zod/dto';
import { CompleteUser, RelatedUserModel } from './index';

export const AuditLogModel = z.object({
  id: z.string(),
  userId: z.string().nullish(),
  action: z.string().min(1).max(50).meta({ description: '操作动作', example: 'CREATE' }),
  resource: z.string().min(1).max(100).meta({ description: '资源标识', example: 'User' }),
  method: z.string().max(10).optional().meta({ description: 'HTTP 方法', example: 'POST' }).nullish(),
  path: z.string().max(255).optional().meta({ description: '请求路径', example: '/api/users' }).nullish(),
  ip: z.string().max(45).optional().meta({ description: '操作 IP', example: '127.0.0.1' }).nullish(),
  metadata: z.json(),
  createdAt: z.date(),
});

export class AuditLogDto extends createZodDto(AuditLogModel) {}

export interface CompleteAuditLog extends z.infer<typeof AuditLogModel> {
  user?: CompleteUser | null;
}

/**
 * RelatedAuditLogModel contains all relations on your model in addition to the scalars
 *
 * NOTE: Lazy required in case of potential circular dependencies within schema
 */
export const RelatedAuditLogModel: z.ZodType<CompleteAuditLog> = z.lazy(() =>
  AuditLogModel.extend({
    user: RelatedUserModel.nullish(),
  }),
);
