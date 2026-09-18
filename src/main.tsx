import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/ibm-plex-sans";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/pt-serif/400.css";
import "@fontsource/pt-serif/700.css";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
