// Load shared styles first, fixing the bundle order ahead of each component's CSS
import "./styles/base.css";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { guidedLoad, guidedRebuildStats, guidedUpdateKeys } from "./lib/guided";
import { restoreSavedKeymap } from "./lib/kb";

// Startup: load history and the saved keymap before rendering
guidedLoad();
guidedRebuildStats();
guidedUpdateKeys();
restoreSavedKeymap(); // auto-restore the previous layout+keymap if present

createRoot(document.getElementById("root")!).render(<App />);
