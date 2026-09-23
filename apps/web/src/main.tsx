import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import {
  appAuthApiBaseUrl,
  appRepository,
} from "./app/data/repositories/app-repository";
import { AppProviders } from "./app/providers/AppProviders";
import "./styles/index.css";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(
  <AppProviders repository={appRepository} authApiBaseUrl={appAuthApiBaseUrl}>
    <App />
  </AppProviders>,
);
