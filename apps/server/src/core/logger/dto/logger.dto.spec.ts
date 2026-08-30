import { QueryAuditLogParams, QueryLogParams } from '../logger.dto'

describe('logger query DTOs', () => {
  it('coerces isSuccess query strings and parses a JSON dateRange tuple', () => {
    const parsed = QueryLogParams.schema.parse({
      isSuccess: 'true',
      dateRange: JSON.stringify(['2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.000Z']),
    })

    expect(parsed.isSuccess).toBe(true)
    expect(parsed.dateRange).toEqual(['2026-01-01T00:00:00.000Z', '2026-01-31T23:59:59.000Z'])
  })

  it('rejects invalid dateRange JSON instead of leaving parse to the service', () => {
    expect(() => QueryLogParams.schema.parse({ dateRange: 'not-json' })).toThrow()
    expect(() => QueryAuditLogParams.schema.parse({ dateRange: '["only-one"]' })).toThrow()
  })

  it('coerces audit success query strings the same way', () => {
    expect(QueryAuditLogParams.schema.parse({ success: 'false' }).success).toBe(false)
    expect(QueryAuditLogParams.schema.parse({ success: '' }).success).toBeUndefined()
  })
})
