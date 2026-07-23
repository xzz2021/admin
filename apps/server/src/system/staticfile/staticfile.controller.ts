import { RequiredPermission } from '@/processor/decorator';
import { Serialize } from '@/processor/decorator/serialize';
import type { JwtReqDto } from '@/system/auth/dto/auth.dto';
import { BadRequestException, Body, Controller, Delete, Get, Header, Post, Req, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createReadStream } from 'fs';
import { join } from 'path';
import { DeleteFileDto, FileListResDto } from './file.dto';
import { generateMulterConfig, multerConfigForAvatar, sanitizePathSegment } from './multer.config';
import { StaticfileService } from './staticfile.service';

@ApiTags('静态文件')
@Controller('staticfile')
export class StaticfileController {
  // private readonly serverUrl;
  private readonly staticFileServeRoot;

  constructor(
    private readonly staticfileService: StaticfileService,
    private readonly configService: ConfigService,
  ) {
    // this.serverUrl = this.configService.get<string>('serverUrl');
    this.staticFileServeRoot = this.configService.get<string>('staticFileServeRoot');
  }
  //  流文件
  @Get('steamfile')
  @RequiredPermission('fileList:view')
  //  形式为 直接下载
  getFile2(): StreamableFile {
    const file = createReadStream(join(process.cwd(), 'package.json'));
    // 设置文件名
    return new StreamableFile(file, {
      disposition: 'attachment; filename="package.json"',
      type: 'application/json',
    });
  }

  @Get('steamfile2')
  @RequiredPermission('fileList:view')
  @Header('Content-Type', 'application/json')
  @Header('Content-Disposition', 'attachment; filename="package.json"')
  getFile3(): StreamableFile {
    const file = createReadStream(join(process.cwd(), 'package.json'));
    // 设置文件名
    return new StreamableFile(file);
  }

  //  内置静态文件管理
  @Get('list')
  @RequiredPermission('fileList:view')
  @Serialize(FileListResDto)
  getFileList() {
    return this.staticfileService.getFileList();
  }

  //  上传文件
  @Post('upload')
  @RequiredPermission('fileList:add')
  @ApiOperation({ summary: '上传文件' })
  @UseInterceptors(FileInterceptor('file', generateMulterConfig('file/manage')))
  uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { code: 400, message: '文件不存在' };
    }

    const fileExt = file.filename.split('.').pop() || ''; // 文件扩展名
    const { filename, path } = file;
    // 文件路径
    // const staticUrl = this.serverUrl;
    // if (!staticUrl) {
    //   throw new BadRequestException('STATIC_URL 配置不存在');
    // }
    const url = `${this.staticFileServeRoot}/file/manage/${filename}`;
    const size = file.size; // 文件大小
    return this.staticfileService.uploadFile({
      name: filename,
      mimeType: file.mimetype,
      path,
      size,
      url,
      extension: fileExt,
    });
  }

  //  删除文件
  @Delete('delete')
  @RequiredPermission('fileList:delete')
  deleteFile(@Body() body: DeleteFileDto) {
    return this.staticfileService.deleteFile(body.ids);
  }

  @Post('upload/avatar')
  @ApiOperation({ summary: '用户上传更新自己的头像' })
  @UseInterceptors(FileInterceptor('file', multerConfigForAvatar))
  uploadAvatar(@UploadedFile() file: Express.Multer.File, @Req() req: JwtReqDto) {
    if (!file) {
      throw new BadRequestException('文件不存在');
    }
    const userPhone: string = req?.user?.phone ?? '';
    if (!userPhone) {
      throw new BadRequestException('用户手机号不存在');
    }
    const phoneSegment = sanitizePathSegment(userPhone);
    const avatarPath = `${this.staticFileServeRoot}/avatar/${phoneSegment}/${file.filename}`;
    return this.staticfileService.updateAvatar(avatarPath, userPhone);
  }
}
