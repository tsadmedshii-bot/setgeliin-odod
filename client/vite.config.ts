import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // npm run build:client нь төслийн үндсэн хавтсаас ажилладаг тул
  // root-ийг cwd-ээс хамаарах 'client' гэж өгнө.
  root: 'client',
  plugins: [react()],
  build: {
    outDir: '../dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
