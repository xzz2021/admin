import { ElMessage } from 'element-plus'
// import * as XLSX from 'xlsx'
import { AudioTypes, DocTypes, FileIcon, ImageTypes, VideoTypes, ZipTypes } from '@/constants/file'

/** 将后端静态资源路径转为可访问 URL */
export const resolveStaticUrl = (url?: string) => {
  if (!url) return ''
  if (/^(https?:|data:)/.test(url)) return url
  return url.startsWith('/') ? url : `/${url}`
}

/** 头像 URL 追加版本参数，避免同路径覆盖后浏览器仍显示旧缓存 */
export const resolveAvatarUrl = (url?: string, version?: number | string) => {
  const resolved = resolveStaticUrl(url)
  if (!resolved) return ''
  if (version === undefined || version === '') return resolved
  const separator = resolved.includes('?') ? '&' : '?'
  return `${resolved}${separator}v=${version}`
}

export const formatFileSize = (size: number) => {
  let formatSize = ''
  if (size > 1024 * 1024 * 1024) {
    formatSize = `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`
  } else if (size > 1024 * 1024) {
    formatSize = `${(size / 1024 / 1024).toFixed(2)} MB`
  } else if (size > 1024) {
    formatSize = `${(size / 1024).toFixed(2)} KB`
  } else {
    formatSize = `${size} B`
  }
  return formatSize
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  const k = 1024
  const units = ['KB', 'MB', 'GB']
  let i = -1
  do {
    n /= k
    i++
  } while (n >= k && i < units.length - 1)
  return `${n.toFixed(2)} ${units[i]}`
}

// 计算文件的sha256
export const getFileSha256 = async (file: File) => {
  const buffer = await file.arrayBuffer() // 将文件转换为 ArrayBuffer
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer) // 计算哈希值
  const hashArray = Array.from(new Uint8Array(hashBuffer)) // 转换为字节数组
  const hashHex = hashArray.map((byte) => byte.toString(16).padStart(2, '0')).join('') // 转换为十六进制字符串
  return hashHex
}

export const getFileIcon = (extension: string) => {
  return FileIcon[extension]
}

type FileType = 'image' | 'video' | 'doc' | 'other' | 'audio' | 'zip'

export const normalizeExtension = (extension?: string | null) => {
  return (extension || '').replace(/^\./, '').trim().toLowerCase()
}

export const isImage = (extension: string) => {
  return ImageTypes.includes(normalizeExtension(extension))
}

export const getFileType = (extension: string): FileType => {
  const ext = normalizeExtension(extension)
  if (ImageTypes.includes(ext)) {
    return 'image'
  } else if (VideoTypes.includes(ext)) {
    return 'video'
  } else if (DocTypes.includes(ext)) {
    return 'doc'
  } else if (AudioTypes.includes(ext)) {
    return 'audio'
  } else if (ZipTypes.includes(ext)) {
    return 'zip'
  } else {
    return 'other'
  }
}

export const getFileIcon2 = (extension: string) => {
  const type = getFileType(extension)
  // console.log('xzz2021: type', type)
  switch (type) {
    case 'image':
      return { icon: 'image', type: 'image' }
    case 'video':
      return { icon: 'video', type: 'video' }
    case 'doc':
      return { icon: 'file-text', type: 'doc' }
    case 'audio':
      return { icon: 'headphones', type: 'audio' }
    case 'zip':
      return { icon: 'folder-open', type: 'zip' }
    default:
      return { icon: 'file-text', type: 'other' }
  }
}

export class FileUnavailableError extends Error {
  constructor(message = '文件已失效或不存在') {
    super(message)
    this.name = 'FileUnavailableError'
  }
}

const toAbsoluteUrl = (url: string) => {
  try {
    return new URL(url, window.location.origin)
  } catch {
    throw new FileUnavailableError('无效的文件地址')
  }
}

/** 探测静态文件是否可访问（优先 Range，兼容不支持 HEAD 的静态服务） */
export async function probeFileAccessible(url: string): Promise<boolean> {
  if (!url) return false
  try {
    const absoluteUrl = toAbsoluteUrl(url)
    const rangeRes = await fetch(absoluteUrl.href, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      credentials: 'include'
    })
    if (rangeRes.ok || rangeRes.status === 206) {
      rangeRes.body?.cancel?.()
      return true
    }
    if (rangeRes.status === 404 || rangeRes.status === 410) {
      return false
    }
    // 部分静态服务拒绝 Range，再试普通 GET
    const getRes = await fetch(absoluteUrl.href, {
      method: 'GET',
      credentials: 'include'
    })
    if (!getRes.ok) return false
    getRes.body?.cancel?.()
    return true
  } catch {
    return false
  }
}

const triggerBlobDownload = (blob: Blob, fileName: string) => {
  const link = document.createElement('a')
  const objectUrl = URL.createObjectURL(blob)
  link.href = objectUrl
  link.download = fileName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export async function downloadFile({
  url,
  fileName
}: {
  url: string
  target?: '_self' | '_blank'
  fileName?: string
}): Promise<boolean> {
  if (!url) {
    throw new FileUnavailableError('无效的文件地址')
  }

  const absoluteUrl = toAbsoluteUrl(url)
  const downloadName = fileName || absoluteUrl.pathname.split('/').pop() || 'download'
  const accessible = await probeFileAccessible(absoluteUrl.href)
  if (!accessible) {
    throw new FileUnavailableError('文件已失效或不存在')
  }

  // 同源：校验通过后走 <a download>，避免大文件整包进内存
  if (absoluteUrl.origin === window.location.origin || absoluteUrl.protocol === 'data:') {
    if (absoluteUrl.protocol === 'data:') {
      const response = await fetch(absoluteUrl.href)
      const blob = await response.blob()
      triggerBlobDownload(blob, downloadName)
      return true
    }
    const link = document.createElement('a')
    link.href = absoluteUrl.href
    link.download = downloadName
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    return true
  }

  try {
    const response = await fetch(absoluteUrl.href, { credentials: 'include' })
    if (!response.ok) {
      throw new FileUnavailableError('文件已失效或不存在')
    }
    const blob = await response.blob()
    if (!blob.size) {
      throw new FileUnavailableError('文件已失效或不存在')
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (contentType.includes('text/html')) {
      throw new FileUnavailableError('文件已失效或不存在')
    }
    triggerBlobDownload(blob, downloadName)
    return true
  } catch (error) {
    if (error instanceof FileUnavailableError) {
      throw error
    }
    throw new FileUnavailableError('文件下载失败，可能已失效')
  }
}

export const formatDataFn = (data: any[]) => {
  return data.map((item) => {
    const { id, children, permissionList, parentId, meta, ...rest } = item
    // 移除meta和permissionList的id
    if (meta) {
      delete meta.id
    }
    if (permissionList) {
      permissionList.forEach((item: any) => {
        delete item.id
      })
    }

    return {
      ...rest,
      permissionList: permissionList?.length ? permissionList : undefined,
      meta: meta ? meta : undefined,
      children: children?.length ? formatDataFn(children) : undefined
    }
  })
}

export const exportSeedData = (data: any[], fileName: string, download = false) => {
  if (!data?.length) {
    ElMessage.error('数据为空')
    return
  }
  // const jsonData = formatDataFn(data)
  const jsonData = JSON.stringify(data, null, 2)
  // 导出下载
  if (download) {
    downloadFile({
      url: 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonData),
      fileName: `${fileName}-seed.json`
    })
  } else {
    // 复制到剪贴板
    navigator.clipboard.writeText(jsonData)
    ElMessage.success('复制成功')
  }
}

// export const exportExcelData = (
//   dataList: any[],
//   fileName: string = 'filename',
//   column?: { label: string; key: string }[]
// ) => {
//   let worksheet
//   if (column?.length) {
//     const aoa = [
//       column.map((c) => c.label),
//       ...dataList.map((row) => column.map((c) => row[c.key] ?? ''))
//     ]
//     worksheet = XLSX.utils.aoa_to_sheet(aoa)
//   } else {
//     worksheet = XLSX.utils.json_to_sheet(dataList)
//   }
//   // 计算每一列的最大宽度（基于字符串长度）
//   const colWidths = Object.keys(dataList[0]).map((key) =>
//     Math.max(
//       key.length, // 表头宽度
//       ...dataList.map((row) => String(row[key]).length) // 数据宽度
//     )
//   )

//   // 设置列宽（wch = char width）
//   worksheet['!cols'] = colWidths.map((w) => ({ wch: w < 20 ? 20 : w + 6 }))
//   const workbook = XLSX.utils.book_new()
//   XLSX.utils.book_append_sheet(workbook, worksheet, fileName)
//   XLSX.writeFile(workbook, `${fileName}.xlsx`)
// }

// 前端分片上传工具类
export class ChunkUploader {
  private chunkSize = 2 * 1024 * 1024 // 2MB 每片
  private file: File
  private totalChunks: number
  private uploadedChunks: Set<number> = new Set()
  private uploadId: string = ''

  constructor(file: File, chunkSize = 2 * 1024 * 1024) {
    this.file = file
    this.chunkSize = chunkSize
    this.totalChunks = Math.ceil(file.size / chunkSize)
  }

  // 初始化分片上传
  async initUpload(): Promise<string> {
    const response = await fetch('/minio/init-multipart-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: this.file.name,
        fileSize: this.file.size,
        mimeType: this.file.type,
        totalChunks: this.totalChunks
      })
    })

    const result = await response.json()
    this.uploadId = result.uploadId
    return this.uploadId
  }

  // 上传单个分片
  async uploadChunk(chunkIndex: number): Promise<boolean> {
    const start = chunkIndex * this.chunkSize
    const end = Math.min(start + this.chunkSize, this.file.size)
    const chunk = this.file.slice(start, end)

    const formData = new FormData()
    formData.append('file', chunk)
    formData.append('uploadId', this.uploadId)
    formData.append('chunkIndex', chunkIndex.toString())
    formData.append('fileName', this.file.name)

    try {
      const response = await fetch('/minio/upload-chunk', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        this.uploadedChunks.add(chunkIndex)
        return true
      }
      return false
    } catch (error) {
      console.error(`分片 ${chunkIndex} 上传失败:`, error)
      return false
    }
  }

  // 完成分片上传
  async completeUpload(): Promise<any> {
    const response = await fetch('/minio/complete-multipart-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId: this.uploadId,
        fileName: this.file.name,
        uploadedChunks: Array.from(this.uploadedChunks)
      })
    })

    return response.json()
  }

  // 获取上传进度
  getProgress(): number {
    return (this.uploadedChunks.size / this.totalChunks) * 100
  }

  // 恢复上传（断点续传）
  async resumeUpload(): Promise<void> {
    const response = await fetch(`/minio/get-upload-progress?uploadId=${this.uploadId}`)
    const progress = await response.json()

    this.uploadedChunks = new Set(progress.uploadedChunks)

    // 继续上传未完成的分片
    for (let i = 0; i < this.totalChunks; i++) {
      if (!this.uploadedChunks.has(i)) {
        await this.uploadChunk(i)
      }
    }
  }
}
