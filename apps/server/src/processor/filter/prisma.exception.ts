import {
  PrismaClientInitializationError,
  PrismaClientKnownRequestError,
  PrismaClientRustPanicError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from '@/prisma/generated/prisma/internal/prismaNamespace'

export const checkPrismaError = (exception: unknown) => {
  if (exception instanceof PrismaClientKnownRequestError) {
    switch (exception.code) {
      case 'P2002':
        return { msg: '数据已存在或复合主键冲突', meta: exception.message }
      case 'P2025':
        return { msg: '当前id记录未找到', meta: exception.message }
      case 'P2003':
        return { msg: '外键约束失败', meta: exception.message }
      case 'P2014':
        return { msg: '关系约束失败', meta: exception.message }
      default:
        return { msg: `数据库操作失败: ${exception.code}`, meta: exception.message }
    }
  }

  if (exception instanceof PrismaClientInitializationError) {
    return { msg: '数据库初始化失败', meta: exception.message }
  }
  if (exception instanceof PrismaClientRustPanicError) {
    return { msg: '数据库Rust Panic', meta: exception.message }
  }

  if (exception instanceof PrismaClientUnknownRequestError) {
    return { msg: '未知的数据库错误', meta: exception.message }
  }

  if (exception instanceof PrismaClientValidationError) {
    return { msg: '数据验证失败', meta: exception.message }
  }

  if (exception && typeof exception === 'object' && 'code' in exception && typeof exception.code === 'string') {
    const err = exception as { code: string; message?: string; toString?: () => string }
    switch (err.code) {
      case 'P2002':
        return { msg: '数据已存在或复合主键冲突', meta: err.message || err.toString?.() }
      case 'P2025':
        return { msg: '当前id记录未找到', meta: err.message || err.toString?.() }
      case 'P2003':
        return { msg: '外键约束失败', meta: err.message || err.toString?.() }
      case 'P2014':
        return { msg: '关系约束失败', meta: err.message || err.toString?.() }
      case 'EPROTO':
        return { msg: 'minio连接失败', meta: err.message || err.toString?.() }
      default:
        return { msg: `数据库操作失败: ${err.code}`, meta: err.message || err.toString?.() }
    }
  }

  return null
}
