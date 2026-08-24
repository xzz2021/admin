import { resolve } from 'path'
import { loadEnv } from 'vite'
import type { UserConfig, ConfigEnv } from 'vite'
import Vue from '@vitejs/plugin-vue'
import VueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import progress from 'vite-plugin-progress'
import EslintPlugin from 'vite-plugin-eslint'
import { ViteEjsPlugin } from 'vite-plugin-ejs'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import UnoCSS from 'unocss/vite'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vitejs.dev/config/
const root = process.cwd()

function pathResolve(dir: string) {
  return resolve(root, '.', dir)
}

export default ({ command, mode }: ConfigEnv): UserConfig => {
  const isBuild = command === 'build'
  const envMode = isBuild ? mode : process.argv[3] === '--mode' ? process.argv[4] : process.argv[3]
  const env = loadEnv(envMode, root)
  const elementPlusImportStyle = env.VITE_USE_ALL_ELEMENT_PLUS_STYLE === 'false' ? 'css' : false

  return {
    base: env.VITE_BASE_PATH,
    plugins: [
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        resolvers: [
          ElementPlusResolver({
            importStyle: elementPlusImportStyle,
          }),
        ],
        dts: pathResolve('types/auto-imports.d.ts'),
      }),
      Components({
        // 仅解析第三方组件；本地组件继续显式导入，避免意外扩大依赖图。
        dirs: [],
        // Element Plus 指令已由 setupElementPlus 注册，避免重复解析及额外类型约束。
        directives: false,
        resolvers: [
          ElementPlusResolver({
            importStyle: elementPlusImportStyle,
          }),
        ],
        dts: pathResolve('types/auto-components.d.ts'),
      }),
      Vue({
        script: {
          // 开启defineModel
          defineModel: true,
        },
      }),
      VueJsx(),
      progress(),
      // 生产构建不要跑 ESLint：会扫全量源码且 cache:false，极易拖慢/抬高内存
      !isBuild
        ? EslintPlugin({
            cache: true,
            failOnWarning: false,
            failOnError: false,
            include: ['src/**/*.vue', 'src/**/*.ts', 'src/**/*.tsx'],
          })
        : undefined,
      VueI18nPlugin({
        runtimeOnly: true,
        compositionOnly: true,
        include: [resolve(__dirname, 'src/locales/**')],
      }),
      createSvgIconsPlugin({
        iconDirs: [pathResolve('src/assets/svgs')],
        symbolId: 'icon-[dir]-[name]',
        svgoOptions: true,
      }),
      ViteEjsPlugin({
        title: env.VITE_APP_TITLE,
      }),
      UnoCSS(),
    ],

    css: {
      preprocessorOptions: {
        less: {
          additionalData: '@import "./src/styles/variables.module.less";',
          javascriptEnabled: true,
        },
      },
    },
    resolve: {
      extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.less', '.css'],
      alias: [
        {
          // runtime-only：生产 CSP 禁止 unsafe-eval（完整构建含 message compiler）
          find: 'vue-i18n',
          replacement: 'vue-i18n/dist/vue-i18n.runtime.esm-bundler.js',
        },
        {
          find: /\@\//,
          replacement: `${pathResolve('src')}/`,
        },
      ],
    },
    esbuild: {
      pure: env.VITE_DROP_CONSOLE === 'true' ? ['console.log'] : undefined,
      drop: env.VITE_DROP_DEBUGGER === 'true' ? ['debugger'] : undefined,
    },
    build: {
      target: 'es2020', // 如果需要兼容老浏览器，可以改为 'es2015'
      outDir: env.VITE_OUT_DIR || 'dist',
      sourcemap: env.VITE_SOURCEMAP === 'true',
      // 跳过 gzip 体积计算，结束阶段可省不少 CPU/内存
      reportCompressedSize: false,
      cssCodeSplit: !(env.VITE_USE_CSS_SPLIT === 'false'),
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        plugins: env.VITE_USE_BUNDLE_ANALYZER === 'true' ? [visualizer()] : undefined,
        output: {
          manualChunks: {
            'vue-chunks': ['vue', 'vue-router', 'pinia', 'vue-i18n'],
            'element-plus': ['element-plus'],
            'wang-editor': ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
            echarts: ['echarts', 'echarts-wordcloud'],
          },
        },
      },
    },
    server: {
      port: 4000,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
      hmr: {
        overlay: false,
      },
      host: '0.0.0.0',
      // 避免 watch dist-pro 导致 Windows EBUSY / 与 build 互相锁文件
      watch: {
        ignored: ['**/dist/**', '**/dist-pro/**', '**/dist-dev/**'],
      },
    },
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'vue-types',
        'element-plus/es/locale/lang/zh-cn',
        'element-plus/es/locale/lang/en',
        '@vueuse/core',
        'axios',
        'qs',
        'echarts',
        'echarts-wordcloud',
        'qrcode',
        '@wangeditor/editor',
        '@wangeditor/editor-for-vue',
        'vue-json-pretty',
        '@zxcvbn-ts/core',
        'dayjs',
        'cropperjs',
      ],
    },
  }
}
