<script setup lang="ts">
import { BaseButton } from '@/components/Button'
import { ElUpload } from 'element-plus'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
    <BaseButton type="primary" :loading="loading">{{ text || t('formDemo.upload') }}</BaseButton>
  </ElUpload>
</template>
