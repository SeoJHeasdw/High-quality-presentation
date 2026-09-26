import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/martian-mono/wdth.css";
import "./styles/base.css";
import "./styles/film.css";
import "./styles/sections.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(<App />);
