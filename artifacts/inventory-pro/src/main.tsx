import { createRoot } from "react-dom/client";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

// Supply each tab's own session token from sessionStorage as a bearer header.
// sessionStorage is tab-scoped (unlike cookies/localStorage), so every tab
// maintains its own independent session even when another tab logs in or out.
setAuthTokenGetter(() => sessionStorage.getItem("tab_session"));

createRoot(document.getElementById("root")!).render(<App />);
