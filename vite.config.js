import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// /api calls are forwarded to the backend, so there's no CORS setup needed in dev
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174, // Solucio HR uses 5173
    proxy: { '/api': 'http://localhost:4000' },
  },
});
