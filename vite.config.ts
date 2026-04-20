import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ["react-dom", "react-dom/client"],
  },
  server: {
    proxy: {
      "/n8n": {
        target: "http://localhost:5678",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@src": path.resolve(__dirname, "src"),
      "@Redux": path.resolve(__dirname, "src/redux"),
      "@Actions": path.resolve(__dirname, "src/redux/actions"),
      "@Reducers": path.resolve(__dirname, "src/redux/reducers"),
      "@Sagas": path.resolve(__dirname, "src/redux/sagas"),
      "@Services": path.resolve(__dirname, "src/redux/services"),
      "@Pages": path.resolve(__dirname, "src/pages"),
      "@Routes": path.resolve(__dirname, "src/routes"),
    },
  },
});
