/* chunk-uploader.ts */

import { safeName } from './safeName'

export type InitResponse = { data: { uploadId: string }; message: string }
export type PresignResponse = { data: { url: string }; message: string }
export type ListedPart = { partNumber: number; etag: string; size: number }
export type ListPartsResponse = { data: { list: ListedPart[] }; message: string }
export type CompleteRequestPart = { partNumber: number; etag: string }
export type CompleteResponse = {
  data: {
    ok: boolean
    bucket: string
    key: string
    size: number
    etag?: string
    contentType?: string
    lastModified?: string
  }
  message: string
}

export interface ChunkUploaderOptions {
  bucket: string
  key?: string // 若不传，将用 fingerprint 生成
  partSize?: number // 默认 16 MiB
  concurrency?: number // 默认 4
  presignTTLSeconds?: number // 预签名过期：默认 3600
  apiBase?: string // 后端基地址（如 /api）
  onProgress?: (p: {
    uploadedBytes: number
    totalBytes: number
    uploadedParts: number
    totalParts: number
    rateBps?: number
  }) => void
  onPart?: (p: { partNumber: number; etag: string }) => void
  signal?: AbortSignal // 可用于取消
  headers?: Record<string, string> // 鉴权等
}

export class ChunkUploader {
  readonly file: File
  readonly opts: Required<Omit<ChunkUploaderOptions, 'onProgress' | 'onPart' | 'signal' | 'headers'>> & {
    onProgress?: ChunkUploaderOptions['onProgress']
    onPart?: ChunkUploaderOptions['onPart']
    signal?: AbortSignal
    headers?: Record<string, string>
  }

  uploadId?: string
  key!: string
  totalParts!: number
  private startedAt = 0
  private uploadedBytes = 0

  constructor(file: File, opts: ChunkUploaderOptions) {
    this.file = file
    this.opts = {
      bucket: opts.bucket,
      key: opts.key ?? '',
      partSize: opts.partSize ?? 16 * 1024 * 1024,
      concurrency: Math.max(1, opts.concurrency ?? 4),
      presignTTLSeconds: opts.presignTTLSeconds ?? 3600,
      apiBase: opts.apiBase ?? '',
      onProgress: opts.onProgress,
      onPart: opts.onPart,
      signal: opts.signal,
      headers: opts.headers
    }
  }

  /** 生成稳定指纹：name + size + lastModified 的 SHA-256（避免读取整文件） */
  static async fingerprint(file: File): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(`${file.name}:${file.size}:${file.lastModified}`)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }

  private lsKey(state: 'session' | 'parts') {
    return `cu:${this.opts.bucket}:${this.key}:${state}`
  }

  /** 加载/保存 简易本地状态（uploadId 与已知 ETag） */
  private loadLocal() {
    const sessionRaw = localStorage.getItem(this.lsKey('session'))
    if (sessionRaw) {
      try {
        const s = JSON.parse(sessionRaw)
        if (s?.uploadId) this.uploadId = s.uploadId
      } catch {
        // localStorage.removeItem(this.lsKey('session'))
      }
    }
  }
  private saveLocalSession() {
    localStorage.setItem(this.lsKey('session'), JSON.stringify({ uploadId: this.uploadId }))
  }
  private saveLocalPart(partNumber: number, etag: string) {
    const map = this.getLocalPartsMap()
    map[partNumber] = etag
    localStorage.setItem(this.lsKey('parts'), JSON.stringify(map))
  }
  private getLocalPartsMap(): Record<number, string> {
    try {
      const raw = localStorage.getItem(this.lsKey('parts'))
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  }
  private clearLocal() {
    localStorage.removeItem(this.lsKey('session'))
    localStorage.removeItem(this.lsKey('parts'))
  }

  /** 计算分片总数，准备 key 与本地状态 */
  private async prepareKeyAndParts(): Promise<void> {
    if (!this.opts.key) {
      //   const fp = await ChunkUploader.fingerprint(this.file)
      // 你也可以在后端生成 key；此处前端默认规则：   决定了存储路径
      this.key = `uploads/${safeName(this.file.name)}`
    } else {
      const path = this.opts.key + '/' + safeName(this.file.name)
      this.key = path.replace(/\/\//g, '/') // 去掉重复的斜杠
    }
    this.totalParts = Math.max(1, Math.ceil(this.file.size / this.opts.partSize))
    this.loadLocal()
  }

  /** 初始化或恢复（向后端发起 CreateMultipartUpload 或使用已存在的uploadId） */
  async initOrResume(): Promise<{ uploadId: string; key: string }> {
    await this.prepareKeyAndParts()
    if (!this.uploadId) {
      const res = await fetch(`${this.opts.apiBase}minio/s3/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(this.opts.headers || {}) },
        body: JSON.stringify({
          bucket: this.opts.bucket,
          key: this.key,
          contentType: 'application/octet-stream'
        }),
        signal: this.opts.signal
      })
      if (!res.ok) throw new Error(`init failed: ${res.status}`)
      const data = (await res.json()) as InitResponse
      this.uploadId = data?.data?.uploadId
      this.saveLocalSession()
    }
    return { uploadId: this.uploadId!, key: this.key }
  }

  /** 从服务端拉取已上传分片，返回现有 partNumber→etag */
  async listServerParts(): Promise<Record<number, string>> {
    const url = new URL(`${this.opts.apiBase}minio/s3/list-parts`, location.origin)
    url.search = new URLSearchParams({
      bucket: this.opts.bucket,
      key: this.key,
      uploadId: this.uploadId!
    }).toString()
    const res = await fetch(url.toString().replace(location.origin, ''), {
      headers: { ...(this.opts.headers || {}) },
      signal: this.opts.signal
    })
    if (!res.ok) throw new Error(`list parts failed: ${res.status}`)
    const data = (await res.json()) as ListPartsResponse
    const parts = data?.data?.list
    const map: Record<number, string> = {}
    for (const p of parts) map[p.partNumber] = stripQuotes(p.etag)
    return map

    function stripQuotes(s: string) {
      return s?.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s
    }
  }

  /** 主流程：自动筛选缺失分片 → 并发上传 → 合并 */
  async uploadAll(): Promise<CompleteResponse> {
    const { uploadId } = await this.initOrResume()
    this.startedAt = Date.now()
    this.uploadedBytes = 0

    const localMap = this.getLocalPartsMap()
    const serverMap = await this.listServerParts()
    console.log('serverMap', serverMap)
    // 合并两边的已知信息（以服务端为准）
    const known: Record<number, string> = { ...localMap, ...serverMap }

    const toUpload: number[] = []
    for (let partNumber = 1; partNumber <= this.totalParts; partNumber++) {
      if (!known[partNumber]) toUpload.push(partNumber)
    }

    // 并发上传
    await this.uploadMissingParts(toUpload, known)

    // 组装 Complete 所需分片列表（必须按 partNumber 升序）
    const completeParts: CompleteRequestPart[] = []
    for (let partNumber = 1; partNumber <= this.totalParts; partNumber++) {
      const etag = known[partNumber]
      if (!etag) throw new Error(`part ${partNumber} missing after upload`)
      completeParts.push({ partNumber, etag })
    }
    // 请求合并
    const completeRes = await fetch(`${this.opts.apiBase}minio/s3/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.opts.headers || {}) },
      body: JSON.stringify({
        bucket: this.opts.bucket,
        key: this.key,
        uploadId,
        parts: completeParts
      }),
      signal: this.opts.signal
    })
    if (!completeRes.ok) throw new Error(`complete failed: ${completeRes.status}`)
    const result = (await completeRes.json()) as CompleteResponse

    // 完成后清理本地状态
    this.clearLocal()
    return result
  }

  /** 仅恢复（不重新 init），会自动调用 listParts 并补齐缺片后 complete */
  async resume(): Promise<CompleteResponse> {
    if (!this.uploadId) await this.initOrResume()
    return this.uploadAll()
  }

  /** 将缺失分片并发上传到各自的预签名 URL */
  private async uploadMissingParts(partNumbers: number[], knownMap: Record<number, string>): Promise<void> {
    const pool = new Set<Promise<void>>()
    let idx = 0

    const runNext = async (): Promise<void> => {
      if (this.opts.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const partNumber = partNumbers[idx++]
      if (partNumber == null) return

      const p = this.uploadSinglePart(partNumber)
        .then(({ etag, bytes }) => {
          knownMap[partNumber] = etag
          this.saveLocalPart(partNumber, etag)
          this.uploadedBytes += bytes
          if (this.opts.onPart) this.opts.onPart({ partNumber, etag })
          this.reportProgress()
        })
        .finally(() => {
          pool.delete(p)
        })

      pool.add(p)
      if (pool.size >= this.opts.concurrency) {
        await Promise.race(pool)
      }
      await runNext()
    }

    await runNext()
    await Promise.all(pool)
  }

  /** 单片上传：拉预签名 → PUT → 读取 ETag（自动重试） */
  private async uploadSinglePart(partNumber: number): Promise<{ etag: string; bytes: number }> {
    // 计算切片范围
    const start = (partNumber - 1) * this.opts.partSize
    const end = Math.min(this.file.size, start + this.opts.partSize)
    const chunk = this.file.slice(start, end)
    const bytes = end - start

    // 取预签名
    const url = new URL(`${this.opts.apiBase}minio/s3/presign-part`, location.origin)
    url.search = new URLSearchParams({
      bucket: this.opts.bucket,
      key: this.key,
      uploadId: this.uploadId!,
      partNumber: String(partNumber),
      expiresIn: String(this.opts.presignTTLSeconds)
    }).toString()
    const pres = await fetch(url.toString().replace(location.origin, ''), {
      headers: { ...(this.opts.headers || {}) },
      signal: this.opts.signal
    })
    if (!pres.ok) throw new Error(`presign failed: ${pres.status}`)
    const res = (await pres.json()) as PresignResponse
    const putUrl = res?.data?.url

    // PUT 上传（带简易重试）
    let attempt = 0
    const maxAttempts = 4
    // 强烈建议透传 Content-Type/MD5（若有）与 Content-Length
    while (true) {
      try {
        const resp = await fetch(putUrl, {
          method: 'PUT',
          body: chunk,
          headers: {
            'Content-Type': this.file.type || 'application/octet-stream',
            'Content-Length': String(bytes)
          },
          signal: this.opts.signal
        })
        if (!resp.ok) throw new Error(`upload part ${partNumber} failed: ${resp.status}`)
        const rawETag = resp.headers.get('ETag') || resp.headers.get('Etag') || ''
        const etag = rawETag.startsWith('"') && rawETag.endsWith('"') ? rawETag.slice(1, -1) : rawETag
        if (!etag) {
          // 某些代理可能不回传 ETag，退化：稍后以 ListParts 校验替代
          return { etag: '', bytes }
        }
        return { etag, bytes }
      } catch (e) {
        if (++attempt >= maxAttempts) throw e
        await sleep(2 ** attempt * 250) // 指数回退
      }
    }

    function sleep(ms: number) {
      return new Promise((res) => setTimeout(res, ms))
    }
  }

  private reportProgress() {
    if (!this.opts.onProgress) return
    const elapsed = (Date.now() - this.startedAt) / 1000
    const rate = elapsed > 0 ? this.uploadedBytes / elapsed : undefined
    const uploadedParts = Math.ceil(this.uploadedBytes / this.opts.partSize)
    this.opts.onProgress({
      uploadedBytes: this.uploadedBytes,
      totalBytes: this.file.size,
      uploadedParts,
      totalParts: this.totalParts,
      rateBps: rate
    })
  }
}
