import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync } from 'fs';

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0', // Allow access from local network
      proxy: {
        '/api': {
          target: 'https://frank-loui-lapore-hp-probook-640-g1.tail11c2e9.ts.net', // Your backend server
          changeOrigin: true,
          secure: false,
        },
      },
    },
    plugins: [
      react(),
      // Custom plugin to copy PWA files to dist
      {
        name: 'copy-pwa-files',
        closeBundle() {
          const files = [
            { src: 'public/service-worker.js', dest: 'dist/service-worker.js' },
            { src: 'public/manifest.json', dest: 'dist/manifest.json' },
            { src: 'public/offline.html', dest: 'dist/offline.html' },
          ];

          files.forEach(({ src, dest }) => {
            try {
              // Ensure dist directory exists
              const destDir = path.dirname(dest);
              mkdirSync(destDir, { recursive: true });
              
              // Copy file
              copyFileSync(src, dest);
              console.log(`✅ Copied ${src} to ${dest}`);
            } catch (error) {
              console.warn(`⚠️ Could not copy ${src}:`, error.message);
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Split vendor chunks for better caching
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});