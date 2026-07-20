import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { App } from "./ui/App";

const container = document.querySelector<HTMLElement>("#root");

if (!container) {
  throw new Error("Application root is unavailable.");
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
