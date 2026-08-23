import { ChunkUploader, type CompleteResponse } from '@/utils/chunk'

const DEFAULT_PART_SIZE = 6 * 1024 * 1024
const API_BASE = String(import.meta.env.VITE_API_BASE_PATH || '')

export const OSS_PUBLIC_BUCKET = String(import.meta.env.VITE_OSS_PUBLIC_BUCKET || '').trim() || 'public'

export interface UploadS3FileOptions {
  file: File
  folderPath?: string
  bucket?: string
  partSize?: number
}

export const resolveOssBucket = (bucket?: string): string => {
  const value = bucket?.trim()
  return value || OSS_PUBLIC_BUCKET
}

export const uploadS3File = (options: UploadS3FileOptions): Promise<CompleteResponse> => {
  const uploader = new ChunkUploader(options.file, {
    bucket: resolveOssBucket(options.bucket),
    key: options.folderPath,
    apiBase: API_BASE,
    partSize: options.partSize ?? DEFAULT_PART_SIZE
  })
  return uploader.uploadAll()
}
