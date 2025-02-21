import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/inter/opsz-italic.css";
import {App} from "./App/App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

// Use contextBridge
window.ipcRenderer.on("main-process-message", (_event, message) => {
    console.log(message);
});
