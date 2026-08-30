import type { transports } from 'winston'
import { createLogFileTransportOptions, createWinstonOptions } from './winston.config'

const MESSAGE = Symbol.for('message')

function formatConsoleLine(isProduction: boolean): string {
  const options = createWinstonOptions({
    isProduction,
    level: 'info',
    appName: 'backstage-server',
  })
  const transport = (Array.isArray(options.transports) ? options.transports[0] : options.transports) as
    transports.ConsoleTransportInstance | undefined
  if (!transport?.format) {
    throw new Error('missing console transport format')
  }
  const result = transport.format.transform({
    level: 'info',
    message: 'hello',
    timestamp: '2026-01-01T00:00:00.000Z',
  }) as { message?: unknown; [key: symbol]: unknown }
  return String(result[MESSAGE] ?? result.message)
}

describe('createWinstonOptions', () => {
  it('uses a single console transport and defaultMeta.service', () => {
    const options = createWinstonOptions({
      isProduction: true,
      level: 'warn',
      appName: 'backstage-server',
    })

    expect(options.level).toBe('warn')
    expect(options.defaultMeta).toEqual({ service: 'backstage-server' })
    expect(options.exceptionHandlers).toBeUndefined()
    expect(Array.isArray(options.transports) ? options.transports : [options.transports]).toHaveLength(1)
  })

  it('emits JSON on the console transport in production', () => {
    const line = formatConsoleLine(true)
    expect(() => JSON.parse(line)).not.toThrow()
    expect(JSON.parse(line)).toEqual(
      expect.objectContaining({
        level: 'info',
        message: 'hello',
      }),
    )
  })

  it('uses nestLike output with the app name in development', () => {
    const line = formatConsoleLine(false)
    expect(line).toContain('backstage-server')
    expect(() => JSON.parse(line)).toThrow()
  })

  it('does not add a file transport unless fileEnabled is true', () => {
    const options = createWinstonOptions({
      isProduction: false,
      level: 'debug',
      appName: 'backstage-server',
      fileEnabled: false,
    })
    const transports = Array.isArray(options.transports) ? options.transports : [options.transports]
    expect(transports).toHaveLength(1)
  })

  it.each([true, false])('adds an hourly warn+ rotating file transport when fileEnabled (prod=%s)', isProduction => {
    const options = createWinstonOptions({
      isProduction,
      level: 'debug',
      appName: 'backstage-server',
      fileEnabled: true,
    })
    const transports = Array.isArray(options.transports) ? options.transports : [options.transports]
    expect(transports).toHaveLength(2)

    const file = transports[1] as { level?: string; dirname?: string; filename?: string }
    expect(file.level).toBe('warn')
    expect(file.dirname).toBe('logs')
    expect(file.filename).toBe('app-%DATE%.log')
  })

  it('rotates warn+ files hourly with a 2m cap and 10-file retention', () => {
    expect(createLogFileTransportOptions()).toEqual({
      level: 'warn',
      dirname: 'logs',
      filename: 'app-%DATE%.log',
      datePattern: 'YYYY-MM-DD-HH',
      maxSize: '2m',
      maxFiles: 10,
      auditFile: 'logs/.audit/app.json',
    })
  })
})
