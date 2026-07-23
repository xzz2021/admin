import { RedisModule, type RedisModuleOptions } from '@liaoliaots/nestjs-redis';
import { ConfigService } from '@nestjs/config';

/** 断线后重连间隔（毫秒） */
export const REDIS_RECONNECT_INTERVAL_MS = 15000;

// 使用模块方式  可以设置多个实例
export const REDIS_MODULE = RedisModule.forRootAsync({
  // isGlobal: true,
  inject: [ConfigService],
  useFactory: (...args: unknown[]): RedisModuleOptions => {
    const configService = args[0] as ConfigService;
    const redis = configService.get('redis');
    return {
      // 可声明多个命名实例
      config: [
        {
          // redis密码
          namespace: 'default',
          // —— 稳健性（直接透传给 ioredis）——
          lazyConnect: false, // 启动时立即连接，便于尽早发现 Redis 不可用
          enableAutoPipelining: true,
          enableOfflineQueue: false, // 断线时不排队等待，命令立即失败
          connectTimeout: 5000, // 连接超时 5s
          maxRetriesPerRequest: 1, // 命令最多重试 1 次，避免请求长时间挂起
          retryStrategy: () => REDIS_RECONNECT_INTERVAL_MS, // 断线后每 5s 自动重连，不限制次数
          reconnectOnError: err => (/READONLY/.test(err.message) ? 1 : false),
          ...redis,
          // TLS（有需要就打开）
          // tls: {},
        },
        // 可再加更多实例...
        // {
        //   namespace: 'master2',
        //   host: 'localhost',
        //   port: 6380,
        //   password: 'authpassword'
        // }
      ],
    };
  },
});
