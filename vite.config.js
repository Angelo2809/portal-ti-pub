import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/assets': 'http://127.0.0.1:3001',
      '/api': {
        target: 'http://127.0.0.1:3001',
        configure(proxy) {
          // The API compares Origin with Host for write requests. Forward the
          // browser-facing host so the local Vite proxy remains same-origin.
          proxy.on('proxyReq', (proxyReq, req) => {
            proxyReq.setHeader('host', req.headers.host);
          });
        },
      },
    },
  },
});
