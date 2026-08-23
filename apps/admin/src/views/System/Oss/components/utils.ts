import { downloadFolderApi, downloadObjectApi, getFileUrlApi } from '@/api/oss'
import { useI18n } from '@/hooks/web/useI18n'
import { getPreviewFilename, isPreviewableType, openPreview } from '@/utils/preview'
import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios'
import { ElMessage } from 'element-plus'

const getFilenameFromHeader = (headers: RawAxiosResponseHeaders | AxiosResponseHeaders) => {
  const contentDisposition = headers['content-disposition']
  let filename = 'download.zip'
  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="(.+)"/)
    if (filenameMatch) {
      filename = decodeURIComponent(filenameMatch[1])
    }
  }
  return filename
}

export const downloadFile = async (rawName: string) => {
  const isFolder = rawName.endsWith('/')
  try {
    const file = isFolder
      ? await downloadFolderApi({
          folderPath: rawName
        })
      : await downloadObjectApi({
          objectName: rawName
        })

    const url = window.URL.createObjectURL(file.data)
    const link = document.createElement('a')
    link.href = url

    const fileName = rawName.split('/').pop() || rawName
    link.download = isFolder ? getFilenameFromHeader(file.headers) : fileName

    document.body.appendChild(link)
    link.click()

    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('文件下载成功')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('文件下载失败')
  }
}

export const previewFile = async (rawName: string, fileType: string) => {
  const { t } = useI18n()
  if (!isPreviewableType(fileType)) {
    ElMessage.error(t('file.previewUnsupported', { type: fileType }))
    return
  }

  try {
    const res = await getFileUrlApi({ objectName: rawName })
    const url = res?.data?.url
    if (!url) {
      ElMessage.error(t('file.previewUrlFailed'))
      return
    }

    await openPreview({
      type: fileType,
      url,
      filename: getPreviewFilename(rawName)
    })
  } catch (error) {
    console.error(error)
    ElMessage.error(t('file.previewFailed'))
  }
}
