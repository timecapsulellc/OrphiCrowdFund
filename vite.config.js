import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  server: {
    port: 5175, // Changed from 3000 to 5175
    open: true,
    host: true, // listen on all addresses
  },
  plugins: [
    react({
      jsxRuntime: 'classic'
    }),
    visualizer({
      filename: 'bundle-stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    })
  ],
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    },
    commonjsOptions: {
      include: [/node_modules/]
    }
  },
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json']
  }
})