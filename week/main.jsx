import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import WeeklyApp from "../src/weekly-app.jsx";
import "../src/index.css";
import "../src/weekly-theme.css";

/* Offline cache. autoUpdate: a new version is fetched in the background and
   picked up the next time the app is opened — nothing to tap, nothing to read. */
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WeeklyApp />
  </React.StrictMode>
);
