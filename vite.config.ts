import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// @ts-expect-error Vite executes this config in Node; the app bundle has no Node dependency.
import { readFileSync } from "node:fs";
// @ts-expect-error Vite executes this config in Node; the app bundle has no Node dependency.
import { resolve } from "node:path";

const publicApiProxy = {
  "/api/v1": {
    target: "https://ukraine.proto.fund",
    changeOrigin: true,
    secure: true,
  },
};

export default defineConfig(({ command }) => ({
  // Local development reads the flat-file warehouse directly. Production only
  // ships the interface; dataset files stay behind Cloud Run and GCS.
  publicDir: command === "serve" ? "public" : false,
  plugins: [
    react(),
    {
      name: "protofund-logo",
      apply: "build",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "pf-logo.png",
          source: readFileSync(resolve("public/pf-logo.png")),
        });
      },
    },
  ],
  server: {
    port: 4173,
    host: "0.0.0.0",
    proxy: publicApiProxy,
  },
  preview: {
    proxy: publicApiProxy,
  },
  build: {
    target: "es2022",
    copyPublicDir: false,
  },
}));
