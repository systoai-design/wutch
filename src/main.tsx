import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Critical CSS is inlined in HTML head for instant FCP
// This full CSS loads after initial render starts

createRoot(document.getElementById("root")!).render(<App />);
