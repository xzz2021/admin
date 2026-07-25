import { PrismaPg } from '@prisma/adapter-pg'
import { NoticeLevel, Prisma, PrismaClient } from '@prisma/generated/prisma/client'
import 'dotenv/config'
import { Pool } from 'pg'

const connectionString = `${process.env.PG_DATABASE_URL}`

const poolConfig = {
  connectionString,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  max: 10,
}
/** 显式 Pool：连接超时可控，断线后下次 checkout 会建新连接 */
const pool = new Pool(poolConfig)

const adapter = new PrismaPg(poolConfig)
const prisma = new PrismaClient({ adapter, transactionOptions: { timeout: 10000 } })

export { adapter, NoticeLevel, pool, prisma, Prisma }
