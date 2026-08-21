import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* Two apps, one site, one deploy:
 *   APP unset  → the original tracker at BASE_PATH        (…/app/)
 *   APP=ppl    → the push/pull/legs tracker one level down (…/app/ppl/)
 * Each gets its own manifest, icons and service worker, so they install as two
 * separate home-screen apps and cache independently.
 *
 * BASE_PATH lets the same build work at a domain root (Netlify, Vercel) and
 * under a subpath (GitHub Pages: BASE_PATH=/app/).
 */
const root = process.env.BASE_PATH || "/";
const isPPL = process.env.APP === "ppl";

const shared = {
  registerType: "autoUpdate",
  includeAssets: ["apple-touch-icon.png"],
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    {
      src: "icon-maskable-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

export default defineConfig({
  root: isPPL ? "ppl" : ".",
  base: isPPL ? `${root}ppl/` : root,
  build: isPPL ? { outDir: "../dist/ppl", emptyOutDir: true } : {},
  plugins: [
    react(),
    VitePWA({
      registerType: shared.registerType,
      includeAssets: shared.includeAssets,
      manifest: {
        name: isPPL ? "PPL" : "Workout",
        short_name: isPPL ? "PPL" : "Workout",
        description: isPPL
          ? "Push pull legs, progressive overload, and body weight."
          : "Gym sessions, progressive overload and daily habits.",
        /* relative, so it also works when served from a subpath */
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: isPPL ? "#0B0C0F" : "#FFFFFF",
        theme_color: isPPL ? "#0B0C0F" : "#0D1014",
        icons: shared.icons,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webmanifest}"],
        /* every route falls back to the cached shell, so it opens with no signal */
        navigateFallback: "index.html",
        /* the outer app's worker also has the inner app inside its scope — keep
           it from answering navigations that belong to the other app */
        ...(isPPL ? {} : { navigateFallbackDenylist: [/\/ppl\//] }),
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
