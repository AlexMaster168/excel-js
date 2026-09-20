import {defineConfig} from 'vitest/config'
import {resolve} from 'node:path'

// import.meta.dirname доступен с Node 20.11+ (у нас Node 24) и работает в ESM.
const root = import.meta.dirname

// Алиасы: '@' -> src, '@core' -> src/core (те же paths в tsconfig.json).
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(root, 'src'),
      '@core': resolve(root, 'src/core')
    }
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
