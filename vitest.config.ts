import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/assets": path.resolve(__dirname, "./assets"),
      "@esports/auth": path.resolve(__dirname, "./packages/auth/src/index.ts"),
      "@esports/sso-sdk": path.resolve(
        __dirname,
        "./packages/sso-sdk/src/index.ts",
      ),
    },
  },
  test: {
    environment: "node",
  },
});
