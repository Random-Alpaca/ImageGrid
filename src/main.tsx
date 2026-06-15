import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import Admin from "./admin/Admin.tsx";
import "./styles/index.css";

// Hidden, unlinked admin page for managing photos. Visit /admin directly.
const path = window.location.pathname.replace(/\/+$/, "");
const Root = path === "/admin" ? Admin : App;

createRoot(document.getElementById("root")!).render(<Root />);
