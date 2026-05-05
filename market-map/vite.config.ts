import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/sp500/market-map/',
  server: {
    port: 5181,
    host: '127.0.0.1'
  }
})
