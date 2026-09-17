import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The build is emitted into web/dist and served as static files by the Express
// app. `npm run dev` proxies API calls to that same app on port 3000.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  }
});
