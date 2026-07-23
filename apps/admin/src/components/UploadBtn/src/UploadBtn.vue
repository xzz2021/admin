<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { ElUpload } from 'element-plus'
import { ref } from 'vue'

const props = defineProps<{
  uploadApi: (file: File) => Promise<void>
  text?: string
}>()

const loading = ref(false)

const beforeUpload = (file: File) => {
  loading.value = true
  props
    .uploadApi(file)
    .catch(() => undefined)
    .finally(() => {
      loading.value = false
    })
  return false
}
</script>

<template>
  <ElUpload :show-file-list="false" :before-upload="beforeUpload" :disabled="loading">
    <BaseButton type="primary" :loading="loading">{{ text || '上传文件' }}</BaseButton>
  </ElUpload>
</template>
