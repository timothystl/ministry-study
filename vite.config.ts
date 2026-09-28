import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
export default defineConfig({
  plugins: [react()],
  // Polling keeps hot reload reliable in sandboxed desktop workspaces.
  server: { watch: { usePolling: true, interval: 400 } },
})
