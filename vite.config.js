import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Only explicitly public configuration may enter the browser bundle.
  // The legacy VITE_ANTHROPIC_API_KEY remains server-only during rotation.
  envPrefix: 'VITE_PUBLIC_',
  server: {
    proxy: {
      '/api': {
        target: 'https://nutrition-app-gold-six.vercel.app',
        changeOrigin: true,
      }
    }
  }
})
