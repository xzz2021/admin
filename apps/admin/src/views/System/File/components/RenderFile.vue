<template>
  <div class="w-full h-[100px] flex justify-center items-center gap-1 px-1">
    <RenderPreview class="cursor-pointer" />
  </div>
</template>
<script setup lang="tsx">
import { getFileType } from '@/utils/file'
import { Icon } from '@/components/Icon'
import { createVideoViewer } from '@/components/VideoPlayer'
import { ElImage } from 'element-plus'
import { defineComponent } from 'vue'
import { createAudioViewer } from '@/components/AudioPlayer'
interface PropsItem {
  extension: string
  url: string
  filename: string
}
const props = defineProps<PropsItem>()

const RenderPreview = defineComponent({
  render() {
    const type = getFileType(props.extension)
    const url = props.url
    const filename = props.filename
    switch (type) {
      case 'image':
        return <ElImage src={url} fit="cover" class="w-[100%]" lazy preview-src-list={[url]} preview-teleported />
      case 'audio':
        return (
          <div onClick={() => createAudioViewer({ url, filename })} class="w-full flex items-center">
            <Icon icon="vi-tdesign:music" style={{ color: '#0dc70b' }} />
            <div class="ml-2 w-[100px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
          </div>
        )
      case 'video':
        return (
          <div onClick={() => createVideoViewer({ url })} class="w-full flex items-center">
            <Icon icon="vi-tdesign:video-camera-music" style={{ color: '#ff6b12' }} />
            <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
          </div>
        )
      case 'doc':
        return (
          <div class="w-full flex items-center">
            <Icon icon="vi-ep:document" style={{ color: '#0070ff' }} />
            <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
          </div>
        )
      default:
        return <div class="ml-2 w-[120px] overflow-hidden text-ellipsis whitespace-nowrap">{filename}</div>
    }
  }
})
</script>

<style scoped>
.scrolling-text {
  position: relative;
  display: inline-block;
  overflow: hidden; /* 隐藏超出容器的部分 */
  white-space: nowrap; /* 保证文字在一行 */
  animation: scroll 10s linear infinite; /* 10s 循环滚动 */
}

@keyframes scroll {
  0% {
    transform: translateX(100%); /* 从右侧开始 */
  }

  100% {
    transform: translateX(-100%); /* 滚动到左侧 */
  }
}
</style>
