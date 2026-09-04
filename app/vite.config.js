import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // app/src/premium is a Windows junction into the sibling ecommnode-premium
  // repo (see README) — without these, Vite resolves it to its real path
  // outside this project root and either bundles duplicate React copies
  // (preserveSymlinks off) or blocks serving its files as outside the
  // allowed fs root (server.fs.allow).
  resolve: {
    preserveSymlinks: true,
  },
  server: {
    fs: {
      // Setting `allow` REPLACES Vite's default list, not extends it —
      // '.' (this project itself, e.g. src/assets) has to be listed
      // explicitly or every static asset the app serves 403s. The
      // ecommnode-premium path is the junction's real target, needed
      // because preserveSymlinks keeps files there from resolving into
      // the project root Vite would otherwise infer as "allowed".
      allow: ['.', 'C:/Users/Administrator/ecommnode-premium'],
    },
  },
})
