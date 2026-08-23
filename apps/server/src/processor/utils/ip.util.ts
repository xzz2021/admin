import type { IncomingMessage } from 'node:http'
import { createRequire } from 'node:module'
import type { Request } from 'express'
import { extractIP } from './string'

const UNKNOWN_LOCATION = '未知'
const LAN_LOCATION = '内网IP'
const MAX_LOCATION_LENGTH = 100

type IpSearcher = {
  search(ip: string): Promise<{ region?: string | null }>
}

type Ip2regionModule = {
  defaultDbFile: string
  loadContentFromFile: (dbPath: string) => Buffer
  newWithBuffer: (buffer: Buffer) => IpSearcher
}

const requireIp2region = createRequire(__filename)

let searcher: IpSearcher | null = null

function isLan(ip: string) {
  const value = ip.toLowerCase()
  if (value === 'localhost' || value === '::1' || value.startsWith('fe80:')) return true
  const parts = value.split('.')
  if (parts.length !== 4) return false
  const a = Number.parseInt(parts[0] ?? '', 10)
  const b = Number.parseInt(parts[1] ?? '', 10)
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31)
}

function getSearcher(): IpSearcher {
  if (!searcher) {
    const mod = requireIp2region('ip2region-ts') as Ip2regionModule
    searcher = mod.newWithBuffer(mod.loadContentFromFile(mod.defaultDbFile))
  }
  return searcher
}

export function formatIpRegion(region?: string | null): string {
  if (!region) return ''
  const [country, , province, city] = region.split('|')
  return [country, province, city]
    .filter(part => part && part !== '0')
    .join(' ')
    .slice(0, MAX_LOCATION_LENGTH)
}

export async function lookupIpLocation(ip?: string | null): Promise<string> {
  const normalized = extractIP(ip ?? '').trim()
  if (!normalized || normalized === '-') return UNKNOWN_LOCATION
  if (isLan(normalized)) return LAN_LOCATION
  try {
    const data = await getSearcher().search(normalized)
    return formatIpRegion(data?.region) || UNKNOWN_LOCATION
  } catch {
    return UNKNOWN_LOCATION
  }
}

export function getIp(request: Request | IncomingMessage) {
  const req = request as Request & {
    raw?: { connection?: { remoteAddress?: string }; socket?: { remoteAddress?: string } }
  }

  let ip: string =
    (request.headers['x-forwarded-for'] as string | undefined) ||
    (request.headers['X-Forwarded-For'] as string | undefined) ||
    (request.headers['X-Real-IP'] as string | undefined) ||
    (request.headers['x-real-ip'] as string | undefined) ||
    req.ip ||
    req.raw?.connection?.remoteAddress ||
    req.raw?.socket?.remoteAddress ||
    ''
  if (ip.includes(',')) ip = ip.split(',')[0] ?? ip

  return ip
}
