import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const backupProxy: ProxyOptions = {
  target: `http://127.0.0.1:${process.env.GYM_BACKUP_PORT || 4174}`,
  configure(proxy) {
    proxy.on("proxyReq", (request, incoming) => {
      const origin = incoming.headers.origin;
      if (!origin || origin === `http://${incoming.headers.host}` || origin === `https://${incoming.headers.host}`) {
        request.removeHeader("origin");
      }
    });
  },
};
const backupRoutes = { "/api/backup": backupProxy, "/api/maintenance": backupProxy };

export default defineConfig({
  preview: { proxy: backupRoutes },
  plugins: [react()],
  optimizeDeps: {
    include: ["react-dom", "react-dom/client"],
  },
  server: {
    proxy: {
      ...backupRoutes,
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
