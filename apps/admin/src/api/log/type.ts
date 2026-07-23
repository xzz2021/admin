export interface LogUserItem {
  username: string
  phone: string
}

export interface LogItem {
  id: number
  user?: LogUserItem | null
  ip: string
  userAgent: string
  method: string
  requestUrl: string
  isSuccess: boolean
  responseMsg?: string | null
  detailInfo?: Record<string, any> | null
  duration: number
  createdAt: string
}

export interface LogListParams {
  pageIndex?: number
  pageSize?: number
  status?: 'success' | 'fail'
  method?: string
  requestUrl?: string
  responseMsg?: string
  dateRange?: string
}
