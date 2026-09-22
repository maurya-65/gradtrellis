import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // The backend runs separately; forward /api to it in development.
    proxy: { "/api": "http://localhost:3000" },
  },
});
