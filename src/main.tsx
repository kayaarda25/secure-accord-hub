import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initAppearancePrefs } from "@/components/settings/AppearanceSettings";

// Apply saved appearance preferences before first render
initAppearancePrefs();

createRoot(document.getElementById("root")!).render(<App />);
