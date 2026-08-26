import { OrganizationGenerationModule } from '@/processor/authorization/organization-generation.module'
import { Module } from '@nestjs/common'
import { DepartmentController } from './department.controller'
import { DepartmentRepository } from './department.repository'
import { DepartmentService } from './department.service'

@Module({
  imports: [OrganizationGenerationModule],
  controllers: [DepartmentController],
  providers: [DepartmentService, DepartmentRepository],
  exports: [DepartmentService, DepartmentRepository],
})
export class DepartmentModule {}
