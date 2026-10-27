import path from "node:path";
import { defineConfig, type Plugin } from "vitest/config";

// RN 资源（require 图片/SVG）在 node 测试环境无法解析，统一返回桩模块。
function assetStub(): Plugin {
  return {
    name: "vitest-asset-stub",
    enforce: "pre",
    load(id) {
      if (id.match(/\.(png|jpe?g|gif|webp|svg)$/)) {
        return "export default 1;";
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [assetStub()],
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
