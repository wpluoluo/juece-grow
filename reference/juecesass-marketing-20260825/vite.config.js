import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import Components from 'unplugin-vue-components/vite'
import { TDesignResolver } from 'unplugin-vue-components/resolvers'

function getMarketingVendorChunk(id) {
  if (!id.includes('node_modules')) {
    return null
  }

  if (id.includes('tdesign-vue-next')) {
    return 'tdesign-vendor'
  }

  if (id.includes('vue') || id.includes('vue-router') || id.includes('pinia')) {
    return 'vue-vendor'
  }

  if (id.includes('@cloudbase')) {
    return 'cloudbase'
  }

  if (id.includes('@fingerprintjs')) {
    return 'fingerprintjs'
  }

  if (id.includes('qrcode')) {
    return 'qrcode'
  }

  return null
}

/**
 * 营销页 Vite 配置
 * 开发环境：独立端口 3000
 * 生产环境：MPA 模式，base: /
 */
export default defineConfig(({ mode }) => {
  // 使用项目根目录的环境变量文件（统一管理）
  const envDir = resolve(__dirname, '../')
  const env = loadEnv(mode, envDir, '')

  // 判断是否为开发环境独立模式
  const isDevStandalone = env.VITE_DEV_MODE === 'standalone' || process.env.VITE_DEV_MODE === 'standalone'

  // 开发环境独立模式：base 为 /，端口 3000
  // 生产环境 MPA 模式：base 为 /（营销页在根路径）
  const base = '/'
  const port = isDevStandalone ? 3000 : 3000

  return {
    plugins: [
      vue(),
      Components({
        dts: false,
        resolvers: [
          TDesignResolver({
            library: 'vue-next'
          })
        ]
      })
    ],
    envDir,
    base,
    publicDir: resolve(__dirname, 'public'),
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared/utils')
      },
      dedupe: ['vue', 'vue-router', 'pinia']
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: 'modern-compiler',
          implementation: 'sass-embedded'
        }
      }
    },
    server: {
      port,
      host: true,
      open: false,
      cors: true
    },
    build: {
      // 统一输出到 bundle-dist/
      outDir: resolve(__dirname, 'bundle-dist'),
      emptyOutDir: true,
      assetsDir: 'assets',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            return getMarketingVendorChunk(id) || undefined
          }
        }
      }
    },
    optimizeDeps: {
      // 关闭自动依赖发现，避免营销页扫描 admin / platform 等子项目源码。
      // Vite 5.1+ 已移除 build 期间的 dep pre-bundling，不再使用 optimizeDeps.disabled。
      noDiscovery: true
    }
  }
})
