import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initPostHog } from "./lib/posthog";

document.documentElement.classList.add('dark');
initPostHog();

createRoot(document.getElementById("root")!).render(<App />);
