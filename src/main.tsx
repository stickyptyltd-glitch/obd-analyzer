import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log("✅ main.tsx loaded");
console.log("✅ React version:", React.version);

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Root element not found!");
  }

  console.log("✅ Root element found, rendering app...");

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  console.log("✅ App rendered successfully");
} catch (error) {
  console.error("❌ Fatal error during initialization:", error);
  document.body.innerHTML = `
    <div style="padding: 40px; background: #1a1a1a; color: #ff4444; font-family: monospace;">
      <h1>❌ Fatal Initialization Error</h1>
      <pre style="background: #000; padding: 20px; border-radius: 8px; overflow: auto;">${error}</pre>
    </div>
  `;
}
