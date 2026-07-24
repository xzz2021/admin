import { buildRedisOptions } from './redis-options'

describe('buildRedisOptions', () => {
  it('omits password when empty or whitespace', () => {
    expect(buildRedisOptions({ host: '127.0.0.1', password: '' })).not.toHaveProperty('password')
    expect(buildRedisOptions({ host: '127.0.0.1', password: '   ' })).not.toHaveProperty('password')
    expect(buildRedisOptions({ host: '127.0.0.1' })).not.toHaveProperty('password')
  })

  it('keeps non-empty password', () => {
    expect(buildRedisOptions({ host: '127.0.0.1', password: 'secret' })).toMatchObject({
      host: '127.0.0.1',
      password: 'secret',
    })
  })
})
