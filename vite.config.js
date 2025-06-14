import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/Polifonias-del-Amar/',
  build: {
    outDir: 'docs'  // <-- AÑADE ESTA SECCIÓN
  }
})