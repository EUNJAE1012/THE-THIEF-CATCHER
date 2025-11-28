import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  define: {
    __VITE_SOCKET_URL__: JSON.stringify(process.env.VITE_SOCKET_URL || '')
  }
})