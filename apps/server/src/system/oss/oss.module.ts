import { Module } from '@nestjs/common'
import { OssController } from './oss.controller'
import { createOssS3Client, loadOssS3Config, OSS_S3_CLIENT, OSS_S3_CONFIG } from './oss.s3'
import { OssService } from './oss.service'

const ossS3Config = loadOssS3Config()

@Module({
  controllers: [OssController],
  providers: [
    {
      provide: OSS_S3_CONFIG,
      useValue: ossS3Config,
    },
    {
      provide: OSS_S3_CLIENT,
      useValue: createOssS3Client(ossS3Config),
    },
    OssService,
  ],
})
export class OssModule {}
