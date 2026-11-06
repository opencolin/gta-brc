import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // the counters and the leaderboard live in api/ (Vercel Functions): `API_PROXY=http://localhost:3000 npm run dev`
  // with `vercel dev --listen 3000` beside it sends /api there; without it they fail quietly and the game plays on
  server: process.env.API_PROXY ? { proxy: { "/api": process.env.API_PROXY } } : undefined,
  // three.js is its own chunk, pulled in only by the lazy chase renderer, so the top-down bundle never pays for it.
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
