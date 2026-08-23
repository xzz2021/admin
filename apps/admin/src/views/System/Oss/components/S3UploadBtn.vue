<script setup lang="ts">
import { UploadBtn } from '@/components/UploadBtn'
import { Icon } from '@/components/Icon'
import { useI18n } from '@/hooks/web/useI18n'
import { OSS_PUBLIC_BUCKET, uploadS3File } from '@/utils/s3-upload'
import { ElMessage } from 'element-plus'

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    folderPath?: string
    bucket?: string
  }>(),
  {
    bucket: OSS_PUBLIC_BUCKET
  }
)

const emit = defineEmits<{
  success: []
}>()

const handleUpload = async (file: File) => {
  try {
    await uploadS3File({
      file,
      folderPath: props.folderPath,
      bucket: props.bucket
    })
    ElMessage.success(t('file.uploadSuccess'))
    emit('success')
  } catch {
    ElMessage.error(t('file.uploadFailed'))
  }
}
</script>

<template>
  <UploadBtn :upload-api="handleUpload" type="success">
    <div class="flex items-center gap-4px">
      <Icon icon="fluent:flash-16-regular" />
      <div>{{ t('formDemo.chunkUpload') }}</div>
    </div>
  </UploadBtn>
</template>
