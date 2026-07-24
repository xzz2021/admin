import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from './app.module';
import { createSwagger } from './core/swagger';
import { GlobalZodValidationPipe } from './processor/pipe/global.zod.validation.pipe';
// import { AllExceptionsFilter } from './processor/filter/exceptions';
// import { VersioningType } from '@nestjs/common';
// =============csfr防攻击 跨站请求伪造=========
// import * as cookieParser from 'cookie-parser';
// import { doubleCsrf } from 'csrf-csrf';
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));

  // 修复：INestApplication 没有 set 方法，使用 express 实例设置 trust proxy     反向代理/CDN 后必开 才能拿到用户真实ip
  // 仅信任固定的两层代理：Nginx Proxy Manager -> admin Nginx。
  app.getHttpAdapter().getInstance().set('trust proxy', 2);

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER)); // 使用winston替换掉nest内置日志

  // app.setGlobalPrefix('api');
  const configService = app.get(ConfigService);
  if (configService.get<boolean>('swagger.enabled')) {
    createSwagger(app, {
      username: configService.getOrThrow<string>('swagger.username'),
      password: configService.getOrThrow<string>('swagger.password'),
    });
  }

  if (configService.get<boolean>('helmet')) {
    app.use(
      helmet({
        crossOriginEmbedderPolicy: false,
        contentSecurityPolicy: {
          directives: {
            imgSrc: [`'self'`, 'data:', '*'],
            scriptSrc: [`'self'`, 'https:', `'unsafe-inline'`],
            manifestSrc: [`'self'`, 'apollo-server-landing-page.cdn.apollographql.com'],
            frameSrc: [`'self'`, 'sandbox.embed.apollographql.com'],
          },
        },
        crossOriginResourcePolicy: { policy: 'cross-origin' }, // 加这一行才能加载图片资源
      }),
    );
  }

  /* const frontendUrl = configService.get<string>('frontendUrl');
   const serverUrl = configService.get<string>('serverUrl');
   const n8nUrl = configService.get<string>('n8nHost');
   console.log('frontendUrl--serverUrl--n8nUrl', frontendUrl, serverUrl, n8nUrl);
    重要  origin内的域名结尾一定不能带/  否则请求头会忽略掉origin
   cookies 携带 跨域
  */
  app.use(cookieParser());
  // app.enableCors({
  //   // origin: [frontendUrl, serverUrl, n8nUrl],
  //   credentials: true,
  //   vary: ['origin'],
  //   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  //   allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  // });

  app.useGlobalPipes(new GlobalZodValidationPipe());
  const port = configService.get<number>('port') as number;
  await app.listen(port, () => {
    console.log(`Server is running on: http://localhost:${port ?? 3000}`);
  });
}
void bootstrap();
