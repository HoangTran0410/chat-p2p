import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    base: "./",
    root: "src",
    build: {
      outDir: "../",
      emptyOutDir: false,
      assetsDir: "public",
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Vendor chunks
            if (id.includes("node_modules")) {
              return "vendor";
            }

            for (const folder of [
              "components",
              "services",
              // "visualizers",
            ]) {
              if (id.includes(`/${folder}/`)) {
                const componentName = id.split(".")?.[0]?.split(`/`)?.at?.(-1);
                console.log(id, componentName);
                if (componentName) {
                  return `${folder}/${componentName.toLowerCase()}`;
                }
              }
            }

            return "default";
          },
        },
      },
    },
    server: {
      allowedHosts: ["1819ebeeb4ac.ngrok-free.app"],
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.API_KEY": JSON.stringify(env.GEMINI_API_KEY),
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
