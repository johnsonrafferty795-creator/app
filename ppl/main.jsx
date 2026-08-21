import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import PPLHub from "../src/ppl-app.jsx";
import "../src/index.css";
import "../src/ppl-theme.css";

/* Offline cache. autoUpdate: a new version is fetched in the background and
   picked up the next time the app is opened — nothing to tap, nothing to read. */
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PPLHub />
  </React.StrictMode>
);
