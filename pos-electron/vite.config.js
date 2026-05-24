import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // BÜTÜN BÜYÜ BURADA: Electron'un dosyaları bulması için bu şart
})