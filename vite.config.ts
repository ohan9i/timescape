import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks(id) {
    if(id.includes('/node_modules/three/examples/'))return 'three-assets'
    if(id.includes('/node_modules/three/'))return 'three'
    if(id.includes('/node_modules/motion')||id.includes('/node_modules/framer-motion'))return 'motion'
  } } } },
})
