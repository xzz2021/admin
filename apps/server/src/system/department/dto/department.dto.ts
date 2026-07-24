import { DepartmentModel } from '@prisma/generated/zod'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const DepartmentIdSchema = z
  .string()
  .min(1)
  .meta({ description: '部门ID', example: 'department-1' })

const DepartmentBaseSchema = DepartmentModel.pick({
  name: true,
  enabled: true,
  description: true,
  parentId: true,
}).extend({
  parentId: DepartmentIdSchema.nullish(),
})

const DepartmentSchema = DepartmentBaseSchema.extend({
  id: DepartmentIdSchema,
})

const CreateDepartmentSchema = DepartmentBaseSchema
export class CreateDepartmentDto extends createZodDto(CreateDepartmentSchema) {}

const UpdateDepartmentSchema = DepartmentSchema.refine(
  data => data.parentId == null || data.id !== data.parentId,
  {
    message: '部门不能设置为自己的父部门',
    path: ['parentId'],
  },
)
export class UpdateDepartmentDto extends createZodDto(UpdateDepartmentSchema) {}

const FindDepartmentSchema = z.object({
  id: DepartmentIdSchema,
})
export class FindDepartmentDto extends createZodDto(FindDepartmentSchema) {}
export class DeleteDepartmentDto extends createZodDto(FindDepartmentSchema) {}

// 排除updatedAt字段
const DepartmentTreeSchema = DepartmentModel.omit({
  updatedAt: true,
}).extend({
  createdAt: z.iso.datetime(),
  get children() {
    return z.array(DepartmentTreeSchema).optional()
  },
})
export class DepartmentListDto extends createZodDto(DepartmentTreeSchema) {}
export class DepartmentListResDto extends createZodDto(DepartmentTreeSchema) {}

const DepartmentSeedSchema = DepartmentBaseSchema.omit({
  parentId: true,
}).extend({
  get children() {
    return z.array(DepartmentSeedSchema).optional()
  },
})
export class UpsertDepartmentDto extends createZodDto(DepartmentSeedSchema) {}
export class DepartmentSeedDto extends createZodDto(DepartmentSeedSchema) {}

const DepartmentSeedArraySchema = z.object({
  data: z.array(DepartmentSeedSchema),
})
export class DepartmentSeedArrayDto extends createZodDto(DepartmentSeedArraySchema) {}
