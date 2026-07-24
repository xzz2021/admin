import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { PrismaClient } from './generated/prisma/client'
import { adapter } from './lib/prisma'

//  关于 中间件已废弃  封装使用prisma的extend的曲线方法 https://github.com/prisma/prisma/issues/18628
@Injectable()
export class PgService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      adapter,
      omit: {
        user: {
          password: true,
        },
      },
    })
  }

  async retryConnect() {
    const MAX_RETRY = 5
    let retryCount = 0
    while (retryCount < MAX_RETRY) {
      try {
        await this.$connect()
        console.log('pg服务数据库连接成功')
        break
      } catch (_err) {
        console.error('重连数据库失败, 3秒后重试!')
        await new Promise(resolve => setTimeout(resolve, 3000))
        retryCount++
        continue
      }
    }
    throw new Error('重连数据库失败, 达到最大重试次数!')
  }

  // 健康检查方法
  async reconnect() {
    try {
      await this.$connect()
    } catch (_err) {
      console.error('重连数据库失败, 3秒后重试!')
      await new Promise(resolve => setTimeout(resolve, 3000))
      await this.reconnect()
    }
  }

  async onModuleInit() {
    await this.$connect()
    console.log('pg服务数据库连接成功')
  }

  async onModuleDestroy() {
    await this.$disconnect()
  }

  // 获取连接池状态
  async getConnectionPoolStats() {
    try {
      const stats = await this.$queryRaw`
        SELECT 
          numbackends as active_connections,
          max_connections,
          state
        FROM pg_stat_database 
        WHERE datname = current_database();
      `
      return stats
    } catch (error) {
      console.error('Failed to get connection pool stats:', error)
      throw error
    }
  }
}
