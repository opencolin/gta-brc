import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // three.js is its own chunk, pulled in only by the lazy chase renderer, so the top-down bundle never pays for it.
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
