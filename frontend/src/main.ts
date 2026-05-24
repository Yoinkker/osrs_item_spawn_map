import "leaflet/dist/leaflet.css";
import "./styles.css";

import { app } from "./appState.ts";
import { bindSidebarControls } from "./sidebarLayout.ts";
import { initApp, showInitError } from "./init.ts";

bindSidebarControls(app);
initApp(app).catch(showInitError);
