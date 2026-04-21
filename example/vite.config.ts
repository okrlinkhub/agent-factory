import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  envDir: "../",
  plugins: [react()],
  resolve: {
    alias: {
      "@okrlinkhub/agent-factory": fileURLToPath(new URL("../src/client/index.ts", import.meta.url)),
      "@okrlinkhub/agent-factory/convex.config.js": fileURLToPath(
        new URL("../src/component/convex.config.ts", import.meta.url),
      ),
      "@okrlinkhub/agent-factory/convex.config": fileURLToPath(
        new URL("../src/component/convex.config.ts", import.meta.url),
      ),
    },
    conditions: ["@convex-dev/component-source"],
  },
});
