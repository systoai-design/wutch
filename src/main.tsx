import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { criticalCSS } from "./criticalStyles.ts";

// Inject critical CSS immediately
const style = document.createElement('style');
style.textContent = criticalCSS;
document.head.insertBefore(style, document.head.firstChild);

createRoot(document.getElementById("root")!).render(<App />);
