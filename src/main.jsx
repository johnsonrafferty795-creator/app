import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import WorkoutHub from "./workout-app.jsx";
import "./index.css";
import "./theme.css";

/* Offline cache. autoUpdate: a new version is fetched in the background and
   picked up the next time the app is opened — nothing to tap, nothing to read. */
registerSW({ immediate: true });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <WorkoutHub />
  </React.StrictMode>
);
