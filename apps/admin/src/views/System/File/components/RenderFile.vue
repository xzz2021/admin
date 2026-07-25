<template>
  <div class="w-full h-[100px] flex justify-center items-center gap-1 px-1">
    <RenderPreview class="cursor-pointer" />
  </div>
</template>
<script setup lang="tsx">
import { createAudioViewer } from '@/components/AudioPlayer'
import { Icon } from '@/components/Icon'
import { createVideoViewer } from '@/components/VideoPlayer'
import { getFileType, probeFileAccessible } from '@/utils/file'
import { ElImage, ElMessage } from 'element-plus'
import { defineComponent, ref } from 'vue'
import { useI18n } from '@/hooks/web/useI18n'

interface PropsItem {
  extension: string
  url: string
  filename: string
}

const props = defineProps<PropsItem>()
const emit = defineEmits<{
  unavailable: []
}>()

const { t } = useI18n()
const imageFailed = ref(false)
const probing = ref(false)

const notifyUnavailable = () => {
  emit('unavailable')
}

const openMedia = async (kind: 'audio' | 'video') => {
  if (!props.url || probing.value) return
  probing.value = true
  try {
    const ok = await probeFileAccessible(props.url)
    if (!ok) {
      ElMessage.error(kind === 'audio' ? t('file.audioUnavailable') : t('file.videoUnavailable'))
      notifyUnavailable()
      return
    }
    if (kind === 'audio') {
      createAudioViewer({
        url: props.url,
        filename: props.filename,
        onUnavailable: notifyUnavailable
      })
    } else {
      createVideoViewer({
        url: props.url,
        onUnavailable: notifyUnavailable
      })
    }
  } finally {
    probing.value = false
  }
}

const RenderPreview = defineComponent({
  setup() {
    return () => {
      const type = getFileType(props.extension)
      const url = props.url
      const filename = props.filename

      switch (type) {
        case 'image':
          if (imageFailed.value) {
            return (
              <div
                class="w-full flex items-center justify-center text-12px color-[var(--el-color-danger)]"
                onClick={notifyUnavailable}
              >
                {t('file.imageUnavailable')}
              </div>
            )
          }
          return (
            <ElImage
              src={url}
              fit="cover"
              class="w-[100%]"
              lazy
              preview-src-list={[url]}
              preview-teleported
              onError={() => {
                imageFailed.value = true
              }}
              v-slots={{
                error: () => <div class="text-12px color-[var(--el-color-danger)]">{t('file.imageUnavailable')}</div>
              }}
            />
          )
        case 'audio':
          return (
            <div
              onClick={() => openMedia('audio')}
              class="w-full flex items-center"
              title={probing.value ? t('file.probing') : filename}
            >
              <Icon icon="headphones" style={{ color: '#0dc70b' }} />
              <div class="ml-2 w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        case 'video':
          return (
            <div
              onClick={() => openMedia('video')}
              class="w-full flex items-center"
              title={probing.value ? t('file.probing') : filename}
            >
              <Icon icon="film" style={{ color: '#ff6b12' }} />
              <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        case 'doc':
          return (
            <div class="w-full flex items-center">
              <Icon icon="file-text" style={{ color: '#0070ff' }} />
              <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
            </div>
          )
        default:
          return <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
      }
    }
  }
})
</script>
