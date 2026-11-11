import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
export default defineConfig({
  plugins: [vue()],
  server: { port: 8343, strictPort: true },
  preview: { port: 8343, strictPort: true },
})
