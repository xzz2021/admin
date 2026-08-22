<script setup lang="tsx">
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { ChunkUploader } from '@/utils/chunk'
import { ElLoading, ElMessage, ElUpload, UploadFile } from 'element-plus'

const { t } = useI18n()

const baseApi = import.meta.env.VITE_API_BASE_PATH
const props = defineProps<{
  folderPath?: string
}>()
const emit = defineEmits(['success'])

const uploadChange = async (uploadFile: UploadFile) => {
  if (!uploadFile.raw) return

  const fileInfo = {
    folderPath: props?.folderPath,
    file: uploadFile.raw
  }

  // 1. 上传文件
  const chunkUploader = new ChunkUploader(uploadFile.raw, {
    bucket: 'public', // 选择 存储桶
    key: fileInfo?.folderPath, // 慎重传递  目录
    apiBase: baseApi,
    partSize: 1024 * 1024 * 6,
    onProgress: ({ uploadedBytes, totalBytes, rateBps, uploadedParts, totalParts }) => {
      const textContent =
        `已传 ${(uploadedBytes / 1e6).toFixed(1)}MB / ${(totalBytes / 1e6).toFixed(1)}MB ` +
        `｜分片 ${uploadedParts}/${totalParts} ` +
        (rateBps ? `｜速度 ${(rateBps / 1e6).toFixed(2)} MB/s` : '')
      console.log(textContent)
    },
    onPart: (part) => {
      console.log(part)
    }
  })
  try {
    ElLoading.service({
      target: document.body,
      text: '上传中...',
      background: 'rgba(0, 0, 0, 0.7)'
    })
    await chunkUploader.uploadAll().finally(() => {
      ElLoading.service().close()
    })
    // await chunkUploader.uploadAll() // 自动初始化/续传/合并
    // alert(`上传完成：${result.data.key} ${result.data.size} bytes`)
    ElMessage.success('上传成功')
    emit('success')
  } catch (err) {
    console.error(err)
    alert('上传失败或已取消')
  }
}
</script>

<template>
  <el-upload class="upload-demo" :auto-upload="false" :show-file-list="false" :on-change="uploadChange">
    <BaseButton type="success">
      <div class="flex items-center gap-4px">
        <Icon icon="fluent:flash-16-regular" />
        <div>{{ t('formDemo.chunkUpload') }}</div>
      </div>
    </BaseButton>
  </el-upload>
</template>
