import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"

import "./styles.css"

import AppRoutes from "./routes/app-routes"
import { BootstrapRoot } from "./bootstrap/bootstrap-root"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <BootstrapRoot>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </BootstrapRoot>
)
