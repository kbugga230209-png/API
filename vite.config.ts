import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    watch: {
      ignored: ['**/ios/**', '**/release/**', '**/dist/**'],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
  optimizeDeps: {
    include: ['pdfjs-dist', 'pdf-lib', 'jszip', 'idb'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'lucide-react'],
          'pdf-vendor': ['pdf-lib', 'pdfjs-dist'],
          'archive-vendor': ['jszip', 'idb'],
        },
      },
    },
  },
});
