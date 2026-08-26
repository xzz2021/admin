import { Module } from '@nestjs/common'
import { OrganizationGenerationService } from './organization-generation.service'

@Module({
  providers: [OrganizationGenerationService],
  exports: [OrganizationGenerationService],
})
export class OrganizationGenerationModule {}
