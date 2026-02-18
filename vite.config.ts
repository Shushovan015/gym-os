import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
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
