import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // DEV_API_PROXY (no VITE_ prefix, so it never reaches the browser bundle) lets a worktree point
  // the dev proxy at its own backend port, e.g. 8011, without touching CORS on the backend.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    server: {
      port: 3000,
      proxy: {
        "/api": {
          target: env.DEV_API_PROXY || "http://localhost:8000",
          changeOrigin: true,
        },
      },
    },
  };
});
