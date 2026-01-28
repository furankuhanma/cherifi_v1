// index.tsx - REMOVE the manual service worker code
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./public/src/App";

// DELETE THIS ENTIRE BLOCK:
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => { ... });
// }

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
