import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const isReplit = process.env.REPL_ID !== undefined;

export default defineConfig({
  plugins: [
    react(),
    ...(isReplit && process.env.NODE_ENV !== "production"
      ? [
          await import("@replit/vite-plugin-runtime-error-modal").then((m) =>
            m.default(),
          ),
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ].filter(Boolean)
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Firebase SDK — large, changes rarely, excellent for long-term caching
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) {
            return 'vendor-firebase';
          }
          // React ecosystem — changes with framework updates
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/wouter')) {
            return 'vendor-react';
          }
          // TanStack Query
          if (id.includes('node_modules/@tanstack')) {
            return 'vendor-query';
          }
          // UI component library — radix, lucide
          if (id.includes('node_modules/@radix-ui') || id.includes('node_modules/lucide-react') || id.includes('node_modules/react-icons')) {
            return 'vendor-ui';
          }
          // Maps — heavy and only used on map pages
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'vendor-maps';
          }
          // i18n — locale data is large
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'vendor-i18n';
          }
          // Zod + form validation
          if (id.includes('node_modules/zod') || id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform')) {
            return 'vendor-forms';
          }
        },
      },
    },
    // Increase chunk warning threshold — vendor bundles are intentionally large
    chunkSizeWarningLimit: 1000,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
