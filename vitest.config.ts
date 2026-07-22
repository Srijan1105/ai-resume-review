import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  // Cast to any to avoid type conflicts between vite versions bundled by vitest and @vitejs/plugin-react
  plugins: [react()] as any,
  css: {
    // Disable PostCSS processing during tests to avoid missing autoprefixer dependency
    postcss: {
      plugins: [],
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
