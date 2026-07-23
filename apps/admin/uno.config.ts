import transformerVariantGroup from '@unocss/transformer-variant-group'
import { defineConfig, toEscapedSelector as e, presetIcons, presetUno } from 'unocss'
import { loadEnv } from 'vite'
import antIcons from './src/components/IconPicker/src/data/icons.ant-design'
import epIcons from './src/components/IconPicker/src/data/icons.ep'
import tIcons from './src/components/IconPicker/src/data/icons.tdesign'
import { ICON_PREFIX } from './src/constants'

const root = process.cwd()

const createPresetIcons = () => {
  const isBuild = !!process.argv[4]
  let env = {} as any
  if (!isBuild) {
    env = loadEnv(process.argv[3], root)
  } else {
    env = loadEnv(process.argv[4], root)
  }
  // @ts-ignore
  if (env.VITE_USE_ONLINE_ICON === 'true') {
    return []
  } else {
    return [
      presetIcons({
        autoInstall: false,
        prefix: ICON_PREFIX
      })
    ]
  }
}

export default defineConfig({
  // ...UnoCSS options
  safelist: [...epIcons.icons, ...antIcons.icons, ...tIcons.icons],
  rules: [
    [
      /^overflow-ellipsis$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector} {
  text-overflow: ellipsis;
}
`
      }
    ],
    [
      /^custom-hover$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector} {
  display: flex;
  height: 100%;
  padding: 1px 10px 0;
  cursor: pointer;
  align-items: center;
  transition: background var(--transition-time-02);
}
/* you can have multiple rules */
${selector}:hover {
  background-color: var(--top-header-hover-color);
}
.dark ${selector}:hover {
  background-color: var(--el-bg-color-overlay);
}
`
      }
    ],
    [
      /^layout-border__left$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 1px;
  height: 100%;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__right$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:after {
  content: "";
  position: absolute;
  top: 0;
  right: 0;
  width: 1px;
  height: 100%;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__top$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ],
    [
      /^layout-border__bottom$/,
      ([], { rawSelector }) => {
        const selector = e(rawSelector)
        return `
${selector}:after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: var(--el-border-color);
  z-index: 3;
}
`
      }
    ]
  ],
  presets: [presetUno({ dark: 'class', attributify: false }), ...createPresetIcons()],
  transformers: [transformerVariantGroup()],
  content: {
    pipeline: {
      include: [/\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html|ts)($|\?)/]
    }
  }
})
