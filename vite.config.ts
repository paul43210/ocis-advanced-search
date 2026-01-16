import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AdvancedSearch',
      fileName: 'index',
      formats: ['amd']
    },
    cssCodeSplit: false,
    rollupOptions: {
      external: ['vue', '@ownclouders/web-pkg', '@ownclouders/web-client', 'vue3-gettext'],
      output: {
        // No named AMD id - must be anonymous module for oCIS
        globals: {
          'vue': 'Vue',
          '@ownclouders/web-pkg': '@ownclouders/web-pkg',
          '@ownclouders/web-client': '@ownclouders/web-client',
          'vue3-gettext': 'vue3-gettext'
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style.css'
          return assetInfo.name || 'asset'
        }
      }
    },
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
})
