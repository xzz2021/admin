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
})
