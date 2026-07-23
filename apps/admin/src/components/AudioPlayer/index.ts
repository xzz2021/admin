import { VNode, createVNode, render } from 'vue'
import AudioPlayer from './src/AudioPlayer.vue'
import { isClient } from '@/utils/is'
import { toAnyString } from '@/utils'

export { AudioPlayer }

interface AudioViewerOptions {
  id?: string
  url: string
  filename: string
  poster?: string
  show?: boolean
  onClose?: () => void
}

let instance: VNode | null = null
let container: HTMLElement | null = null

export function createAudioViewer(options: AudioViewerOptions) {
  if (!isClient) return

  const { show = true, url, filename } = options

  if (instance) {
    instance.component!.props!.url = url
    instance.component!.props!.filename = filename || '未知音频'
    instance.component!.props!.show = show
    return
  }

  container = document.createElement('div')
  const id = toAnyString()
  container.id = id

  const onClose = () => {
    setTimeout(() => {
      if (instance) {
        instance.component!.props!.show = false
      }
    }, 150)
  }

  const propsData: Partial<AudioViewerOptions> = {
    ...options,
    id,
    onClose
  }
  document.body.appendChild(container)
  instance = createVNode(AudioPlayer, propsData)
  render(instance, container)
}

// 提供销毁所有实例的方法
export function destroyAllAudioViewers() {
  if (container) {
    render(null, container)
    document.body.removeChild(container)
  }
}
