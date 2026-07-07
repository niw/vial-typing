// Load shared styles first, fixing the bundle order ahead of each component's CSS
import "./styles/base.css";
import { createRoot } from "react-dom/client";
import { App } from "./components/App";
import { guidedLoad, guidedRebuildStats, guidedUpdateKeys } from "./lib/guided";
import { locale, t } from "./lib/i18n";
import { restoreSavedKeymap } from "./lib/kb";

// Reflect the resolved locale on the document (index.html defaults to English before JS runs)
document.documentElement.lang = locale;
document.title = t("docTitle");

// Startup: load history and the saved keymap before rendering
guidedLoad();
guidedRebuildStats();
guidedUpdateKeys();
restoreSavedKeymap(); // auto-restore the previous layout+keymap if present

createRoot(document.getElementById("root")!).render(<App />);
