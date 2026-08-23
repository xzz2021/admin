import { formatIpRegion, lookupIpLocation } from './ip.util'

describe('lookupIpLocation', () => {
  it('maps loopback and private addresses to LAN', async () => {
    await expect(lookupIpLocation('127.0.0.1')).resolves.toBe('内网IP')
    await expect(lookupIpLocation('::ffff:127.0.0.1')).resolves.toBe('内网IP')
    await expect(lookupIpLocation('192.168.1.1')).resolves.toBe('内网IP')
    await expect(lookupIpLocation('10.0.0.8')).resolves.toBe('内网IP')
  })

  it('returns unknown for empty input', async () => {
    await expect(lookupIpLocation('')).resolves.toBe('未知')
    await expect(lookupIpLocation('-')).resolves.toBe('未知')
    await expect(lookupIpLocation(null)).resolves.toBe('未知')
  })

  it('formats ip2region region as country province city', () => {
    expect(formatIpRegion('中国|0|广东省|深圳市|电信')).toBe('中国 广东省 深圳市')
    expect(formatIpRegion('美国|0|0|0|0')).toBe('美国')
  })

  it('resolves a public IPv4 to city-level location', async () => {
    await expect(lookupIpLocation('218.4.167.70')).resolves.toBe('中国 江苏省 苏州市')
  })
})
