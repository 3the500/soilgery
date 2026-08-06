import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',   // Capacitor가 읽는 기본 빌드 경로
  },
  preview: {
    allowedHosts: ["outstanding-celebration-production.up.railway.app"],
  },
})
