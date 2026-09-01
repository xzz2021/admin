import { appConfig, validateEnvironment } from './index'

describe('production environment validation', () => {
  const validEnvironment = {
    NODE_ENV: 'production',
    PORT: '3000',
    PG_DATABASE_URL: 'postgresql://app_runtime:strong-random-db-secret@postgres:5432/app',
    TOKEN_SECRET: 'a-strong-random-token-secret-with-more-than-32-chars',
    TOKEN_REFRESH_SECRET: 'another-strong-random-refresh-secret-over-32-chars',
    REDIS_HOST: 'redis',
    REDIS_PORT: '6379',
    REDIS_PASSWORD: 'strong-random-redis-secret',
    STATIC_FILE_ROOT_PATH: 'public',
    STATIC_FILE_SERVE_ROOT: 'api/public',
  }

  it('allows Swagger to remain disabled without credentials', () => {
    expect(
      validateEnvironment({
        ...validEnvironment,
        SWAGGER: 'false',
      }),
    ).toMatchObject({ SWAGGER: 'false' })
  })

  it('requires explicit strong credentials when Swagger is enabled', () => {
    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SWAGGER: 'true',
      }),
    ).toThrow()

    expect(() =>
      validateEnvironment({
        ...validEnvironment,
        SWAGGER: 'true',
        SWAGGER_USERNAME: 'docs-admin',
        SWAGGER_PASSWORD: 'short',
      }),
    ).toThrow()

    expect(
      validateEnvironment({
        ...validEnvironment,
        SWAGGER: 'true',
        SWAGGER_USERNAME: 'docs-admin',
        SWAGGER_PASSWORD: 's7R!m2Q#v9L@k4T$x8W',
      }),
    ).toMatchObject({
      SWAGGER: 'true',
      SWAGGER_USERNAME: 'docs-admin',
    })
  })

  it('treats LOG_FILE as an opt-in flag', () => {
    const previous = process.env.LOG_FILE
    delete process.env.LOG_FILE
    expect(appConfig().logger.fileEnabled).toBe(false)

    process.env.LOG_FILE = 'true'
    expect(appConfig().logger.fileEnabled).toBe(true)

    process.env.LOG_FILE = 'false'
    expect(appConfig().logger.fileEnabled).toBe(false)

    if (previous === undefined) {
      delete process.env.LOG_FILE
    } else {
      process.env.LOG_FILE = previous
    }
  })

  it('defaults file upload limits to 500MB / 5MB / 24h / 5 sessions', () => {
    const previous = {
      max: process.env.FILE_UPLOAD_MAX_BYTES,
      chunk: process.env.FILE_UPLOAD_CHUNK_BYTES,
      ttl: process.env.FILE_UPLOAD_SESSION_TTL_HOURS,
      open: process.env.FILE_UPLOAD_MAX_OPEN_SESSIONS,
    }
    delete process.env.FILE_UPLOAD_MAX_BYTES
    delete process.env.FILE_UPLOAD_CHUNK_BYTES
    delete process.env.FILE_UPLOAD_SESSION_TTL_HOURS
    delete process.env.FILE_UPLOAD_MAX_OPEN_SESSIONS

    expect(appConfig().fileUpload).toEqual({
      maxBytes: 524288000,
      chunkBytes: 5242880,
      sessionTtlHours: 24,
      maxOpenSessions: 5,
    })

    if (previous.max === undefined) delete process.env.FILE_UPLOAD_MAX_BYTES
    else process.env.FILE_UPLOAD_MAX_BYTES = previous.max
    if (previous.chunk === undefined) delete process.env.FILE_UPLOAD_CHUNK_BYTES
    else process.env.FILE_UPLOAD_CHUNK_BYTES = previous.chunk
    if (previous.ttl === undefined) delete process.env.FILE_UPLOAD_SESSION_TTL_HOURS
    else process.env.FILE_UPLOAD_SESSION_TTL_HOURS = previous.ttl
    if (previous.open === undefined) delete process.env.FILE_UPLOAD_MAX_OPEN_SESSIONS
    else process.env.FILE_UPLOAD_MAX_OPEN_SESSIONS = previous.open
  })
})
