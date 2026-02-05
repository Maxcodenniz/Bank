import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Enable HTTPS for local development (allows camera access)
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // Allow external connections
    // HTTPS is enabled via @vitejs/plugin-basic-ssl plugin above
    allowedHosts: [
      'e3879f6ce5d3.ngrok-free.app',
      '.ngrok-free.app', // Allow all ngrok free domains
      '.ngrok.app', // Allow all ngrok domains
    ],
  },
});
