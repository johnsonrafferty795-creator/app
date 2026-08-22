import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import GolfApp from "../src/golf-app.jsx";
import "../src/index.css";
import "../src/golf-theme.css";

/* Offline cache. autoUpdate: a new version is fetched in the background and
   picked up the next time the app is opened — nothing to tap, nothing to read. */
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <GolfApp />
  </React.StrictMode>
);
