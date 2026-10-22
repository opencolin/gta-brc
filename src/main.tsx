import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import PlayaWin from "./game/PlayaWin";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="gta">
      <PlayaWin />
    </main>
  </StrictMode>,
);
