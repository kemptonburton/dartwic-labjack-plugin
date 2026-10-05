import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceManifestPath = path.resolve(__dirname, "plugin.json");
const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"));
const pluginId = String(sourceManifest.id ?? "").trim();
const releasePluginDir = path.resolve(__dirname, "plugin", "interface", pluginId);
const releaseUiDir = path.resolve(releasePluginDir, "ui");
const releaseManifestPath = path.resolve(releasePluginDir, "plugin.json");
const interfaceSourceDir = path.resolve(__dirname, "interface", "src");
const runtimeEntryPath = path.resolve(interfaceSourceDir, "runtime.ts");

async function ensureDir(dirPath: string) {
  await mkdir(dirPath, { recursive: true });
}

function createDartwicPluginCopyPlugin() {
  return {
    name: "dartwic-plugin-copy",
    async writeBundle() {
      await ensureDir(releaseUiDir);
      await cp(sourceManifestPath, releaseManifestPath, { force: true });
      // Installed interface plugins contain only their manifest and compiled
      // runtime. Source remains exclusively in this plugin repository.
      await rm(path.resolve(releasePluginDir, "src"), { recursive: true, force: true });
    }
  };
}

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: "classic",
    }),
    createDartwicPluginCopyPlugin(),
  ],
  build: {
    target: "es2020",
    outDir: releaseUiDir,
    emptyOutDir: true,
    lib: {
      entry: runtimeEntryPath,
      formats: ["iife"],
      name: "DartwicLabJackT7Plugin",
      fileName: () => "index.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      "@dartwic/interface-sdk": path.resolve(__dirname, "interface", "sdk"),
    },
  },
});
