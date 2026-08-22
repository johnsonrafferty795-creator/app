import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/* Four apps, one site, one deploy:
 *   APP unset  → the original tracker at BASE_PATH        (…/app/)
 *   APP=ppl    → the push/pull/legs tracker one level down (…/app/ppl/)
 *   APP=dogs   → the dog training tracker                  (…/app/dogs/)
 *   APP=week   → the weekly task list                      (…/app/week/)
 * Each gets its own manifest, icons and service worker, so they install as
 * separate home-screen apps and cache independently.
 *
 * BASE_PATH lets the same build work at a domain root (Netlify, Vercel) and
 * under a subpath (GitHub Pages: BASE_PATH=/app/).
 */
const root = process.env.BASE_PATH || "/";
/* the outer app is the one with no folder of its own */
const app = process.env.APP || "";

const META = {
  "": {
    name: "Workout",
    short: "Workout",
    description: "Gym sessions, progressive overload and daily habits.",
    background: "#FFFFFF",
    theme: "#0D1014",
  },
  ppl: {
    name: "PPL",
    short: "PPL",
    description: "Push pull legs, progressive overload, and body weight.",
    background: "#0B0C0F",
    theme: "#0B0C0F",
  },
  dogs: {
    name: "Dog Training",
    short: "Dogs",
    description: "Daily training checklists for Maisie and George.",
    background: "#FAF6EF",
    theme: "#1F6A4A",
  },
  week: {
    name: "Weekly",
    short: "Weekly",
    description: "A weekly task list that unticks itself every week.",
    background: "#0B0B0C",
    theme: "#0B0B0C",
  },
};

const meta = META[app];
if (!meta) throw new Error(`Unknown APP: ${app}`);

/* the inner apps live in a folder each; the outer one owns the root */
const inner = app !== "";

const icons = [
  { src: "icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "icon-512.png", sizes: "512x512", type: "image/png" },
  {
    src: "icon-maskable-512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

export default defineConfig({
  root: inner ? app : ".",
  base: inner ? `${root}${app}/` : root,
  build: inner ? { outDir: `../dist/${app}`, emptyOutDir: true } : {},
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: meta.name,
        short_name: meta.short,
        description: meta.description,
        /* relative, so it also works when served from a subpath */
        start_url: "./",
        scope: "./",
        display: "standalone",
        orientation: "portrait",
        background_color: meta.background,
        theme_color: meta.theme,
        icons,
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,jpg,svg,ico,webmanifest,woff2}"],
        /* every route falls back to the cached shell, so it opens with no signal */
        navigateFallback: "index.html",
        /* the outer app's worker also has the inner apps inside its scope — keep
           it from answering navigations that belong to one of them */
        ...(inner
          ? {}
          : {
              navigateFallbackDenylist: Object.keys(META)
                .filter(Boolean)
                .map((name) => new RegExp(`/${name}/`)),
            }),
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
});
