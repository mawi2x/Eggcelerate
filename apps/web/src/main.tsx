import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import {
  appAuthApiBaseUrl,
  appRepository,
} from "./app/data/repositories/app-repository";
import { AppProviders } from "./app/providers/AppProviders";
import { retryLazyScreens } from "./app/routing/lazy-screens";
import "./styles/index.css";
import { RecoveryBoundary } from "./app/components/RecoveryBoundary";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Missing #root element");
createRoot(rootElement).render(
  <RecoveryBoundary scope="app" onRetry={retryLazyScreens}>
    <AppProviders repository={appRepository} authApiBaseUrl={appAuthApiBaseUrl}>
      <App />
    </AppProviders>
  </RecoveryBoundary>,
);
