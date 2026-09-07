import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base: works on GitHub Pages (/Aura-AI/), Vercel root, any path.
export default defineConfig({
  plugins: [react()],
  base: './',
})
