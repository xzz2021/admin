import { downloadFolderApi, downloadObjectApi, getFileUrlApi } from '@/api/oss'
import { createAudioViewer } from '@/components/AudioPlayer'
import { createImageViewer } from '@/components/ImageViewer'
import { createTxtViewer } from '@/components/TxtViewer'
import { createVideoViewer } from '@/components/VideoPlayer'
import { AxiosResponse, AxiosResponseHeaders, RawAxiosResponseHeaders } from 'axios'
import { ElMessage } from 'element-plus'

// 根据后端返回的headers里传递的文件名进行命名
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
    const blob: AxiosResponse<Blob> = isFolder
      ? await downloadFolderApi({
          folderPath: rawName
        })
      : await downloadObjectApi({
          objectName: rawName
        })

    // 创建下载链接
    const url = window.URL.createObjectURL(blob.data)
    const link = document.createElement('a')
    link.href = url

    // 从文件名中提取实际的文件名（去掉路径前缀）
    const fileName = rawName.split('/').pop() || rawName
    link.download = isFolder ? getFilenameFromHeader(blob.headers) : fileName

    // 触发下载
    document.body.appendChild(link)
    link.click()

    // 清理
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)

    ElMessage.success('文件下载成功')
  } catch (error) {
    console.error('下载失败:', error)
    ElMessage.error('文件下载失败')
  }
}

export const previewFile = async (rawName: string, fileType: string) => {
  // 先检查文件类型是否支持预览
  const supportedTypes = ['image', 'video', 'audio', 'doc']
  if (!supportedTypes.includes(fileType)) {
    ElMessage.error(`暂不支持预览该文件类型: ${fileType}`)
    return
  }

  try {
    // 只有支持的类型才请求 URL
    const res = await getFileUrlApi({ objectName: rawName as string })
    const url = res?.data?.url as string

    if (!url) {
      ElMessage.error('获取文件预览链接失败')
      return
    }

    // 使用映射表简化预览逻辑
    const previewHandlers = {
      image: () => createImageViewer({ urlList: [url] }),
      video: () => createVideoViewer({ url }),
      audio: () => createAudioViewer({ url, filename: rawName }),
      doc: () => createTxtViewer({ url })
    }

    const handler = previewHandlers[fileType as keyof typeof previewHandlers]
    handler()
  } catch (error) {
    console.error('文件预览失败:', error)
    ElMessage.error('文件预览失败，请稍后重试')
  }
}
