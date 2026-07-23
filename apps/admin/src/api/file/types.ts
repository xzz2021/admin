export interface FileItem {
  id: number
  name: string
  mimeType: string
  path: string
  extension?: string | null
  size: number
  url: string
  createdAt: string
}

export interface FileListParams {
  name?: string
  mimeType?: string
  extension?: string
}
