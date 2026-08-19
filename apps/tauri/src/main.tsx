import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router"

import "@workspace/ui/globals.css"

import AppRoutes from "./routes/app-routes"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <BrowserRouter>
    <AppRoutes />
  </BrowserRouter>
)
