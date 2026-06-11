import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { execSync } from "node:child_process";

// Visible build stamp — injected into the bundle so the footer can show
// exactly which build is live. Turns "why is my Mac on the old version?"
// from a multi-message investigation into a 2-second glance: if the footer
// stamp matches the latest deploy, the view is current; if not, it's a
// stale browser tab (refresh). Build-time only (normal Node, not runtime).
const BUILD_ID = (() => {
  const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
  try {
    const sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
    return sha ? `${ts} · ${sha}` : ts;
  } catch {
    return ts; // git unavailable in some CI contexts — timestamp alone still proves currency
  }
})();

// Replit dev-IDE plugins removed 2026-05-17 — they only loaded inside the
// Replit web IDE (gated on REPL_ID + NODE_ENV !== 'production') and the
// dependencies `@replit/vite-plugin-runtime-error-modal` and
// `@replit/vite-plugin-cartographer` were removed from package.json in the
// same PR. Production builds were never affected; this just removes the
// dev-IDE-only error overlay we no longer use.

export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    react(),
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
    // Hidden source maps: generated but not referenced in bundle — only for Sentry/error monitoring
    sourcemap: 'hidden',
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
