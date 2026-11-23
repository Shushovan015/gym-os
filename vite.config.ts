import { defineConfig, type Plugin, type ProxyOptions } from "vite";
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
const phpRoutes: Record<string, ProxyOptions> = process.env.GYM_PHP_DEV_URL
  ? { "/api": { target: process.env.GYM_PHP_DEV_URL } }
  : {};

const enforcePhpRuntime: Plugin = {
  name: "php-production-runtime",
  generateBundle(_options, bundle) {
    for (const output of Object.values(bundle)) {
      if (output.type === "chunk" && Object.keys(output.modules).some((id) => /[\\/]@supabase[\\/]/.test(id))) {
        this.error("The PHP production build must not contain the legacy backend SDK.");
      }
    }
  },
};

export default defineConfig(({ mode }) => ({
  define: mode === "php" ? {
    "import.meta.env.VITE_GYM_BACKEND": JSON.stringify("php"),
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
    "import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_URL": JSON.stringify(""),
    "import.meta.env.VITE_N8N_MEMBERS_WEBHOOK_SECRET": JSON.stringify(""),
  } : undefined,
  preview: { proxy: { ...(mode === "php" ? {} : backupRoutes), ...phpRoutes } },
  plugins: mode === "php" ? [react(), enforcePhpRuntime] : [react()],
  optimizeDeps: {
    include: ["react-dom", "react-dom/client"],
  },
  server: {
    proxy: {
      ...backupRoutes,
      ...phpRoutes,
      "/n8n": {
        target: "http://localhost:5678",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/n8n/, ""),
      },
    },
  },
  resolve: {
    alias: {
      ...(mode === "php" ? { "@src/Client/supabase": path.resolve(__dirname, "src/Client/legacyBackendUnavailable.ts") } : {}),
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
}));
