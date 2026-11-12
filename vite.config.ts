import { realpathSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Windows paths are case-insensitive but Rolldown treats them as case-sensitive. Building from
// a shell whose directory is typed in the wrong case (d:\code instead of D:\Code) made it load
// Pinia twice, and the deployed app crashed. Using the real on-disk casing avoids that.
const root = realpathSync.native(process.cwd())

export default defineConfig({
  root,
  plugins: [vue()],
  resolve: {
    alias: { '@': join(root, 'src') },
  },
  build: {
    // Firestore alone is about 580 kB and can't be made smaller, so the default 500 kB warning is noise.
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        // Firebase changes far less often than the app, so keeping it in its own files means a
        // deploy only re-downloads the app code, and Firestore and Auth load as separate files.
        codeSplitting: {
          groups: [
            { name: 'firebase-firestore', test: /node_modules[\\/](@firebase[\\/]firestore|firebase[\\/]firestore|@grpc|protobufjs|@protobufjs)/, priority: 30 },
            { name: 'firebase-auth', test: /node_modules[\\/](@firebase[\\/]auth|firebase[\\/]auth)/, priority: 20 },
            { name: 'firebase-core', test: /node_modules[\\/](@firebase|firebase|idb)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
