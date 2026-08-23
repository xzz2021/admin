import { sanitizeAuditMetadata } from './audit-log.sanitize'

describe('sanitizeAuditMetadata', () => {
  it('redacts nested credential fields', () => {
    expect(
      sanitizeAuditMetadata({
        username: 'alice',
        password: 'plain',
        nested: { refreshToken: 'abc', enabled: true },
      }),
    ).toEqual({
      username: 'alice',
      password: '[Redacted]',
      nested: { refreshToken: '[Redacted]', enabled: true },
    })
  })

  it('returns null for empty input', () => {
    expect(sanitizeAuditMetadata(null)).toBeNull()
    expect(sanitizeAuditMetadata(undefined)).toBeNull()
  })
})
