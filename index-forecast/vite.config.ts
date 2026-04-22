import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/sp500/index-forecast/",
  plugins: [react()],
  server: {
    port: 5174,
  },
});
