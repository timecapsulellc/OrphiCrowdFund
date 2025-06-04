import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), visualizer({ open: true, filename: 'dist/bundle-report.html' })],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for core React libraries
          vendor: ['react', 'react-dom'],
          // Charts chunk for visualization libraries
          charts: ['recharts', 'd3'],
          // Tree chunk for genealogy tree
          tree: ['react-d3-tree'],
          // Export chunk for PDF/canvas functionality
          export: ['jspdf', 'html2canvas', 'file-saver'],
          // Ethereum chunk for blockchain libraries
          ethereum: ['ethers']
        }
      }
    },
    // Enable source maps for production debugging
    sourcemap: false,
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 500,
    // Enable minification
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': '/docs/components'
    }
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: ['jspdf', 'html2canvas'] // Lazy load these
  }
})
