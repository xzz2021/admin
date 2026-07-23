export interface OssListItem {
  name: string
  etag: string
  lastModified: Date
  size: number
  prefix?: string
}

export interface OssListResponse {
  list: OssListItem[]
  total: number
}
