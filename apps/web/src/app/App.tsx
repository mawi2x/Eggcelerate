import { useState, useEffect, lazy, Suspense } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { AppSidebar, ScreenId } from "./components/AppSidebar";
import { PageHeader } from "./components/PageHeader";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { IncubatorsScreen } from "./components/screens/IncubatorsScreen";
import { AlertsScreen } from "./components/screens/AlertsScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { HelpWidget } from "./components/HelpWidget";
import { SuspenseFallback } from "./components/SuspenseFallback";

const DetailScreen = lazy(() =>
  import("./components/screens/DetailScreen").then((m) => ({ default: m.DetailScreen })),
);
const TrendsScreen = lazy(() =>
  import("./components/screens/TrendsScreen").then((m) => ({ default: m.TrendsScreen })),
);
import {
  initialIncubators,
  initialModes,
  initialAlerts,
  AlertEntry,
  Incubator,
  Mode,
  HatchRecord,
  hatchHistory,
} from "./data/mockData";
import { Account, initialAccount, resolveDisplayName } from "./data/account";
import { deriveConditionSeverity, unitStatusFromConditionSeverity } from "./domain/cycle";

function getInitialNavState(): { screen: ScreenId; selectedUnit: string | null } {
  if (typeof window === "undefined") return { screen: "overview", selectedUnit: null };
  const params = new URLSearchParams(window.location.search);
  const screenParam = params.get("screen") as ScreenId | null;
  const unitParam = params.get("unit");
  const validScreens: ScreenId[] = ["overview", "incubators", "detail", "trends", "alerts", "settings"];
  const screen = screenParam && validScreens.includes(screenParam) ? screenParam : "overview";
  return { screen, selectedUnit: unitParam };
}

export default function App() {
  const [initialNav] = useState(getInitialNavState);
  const [screen, setScreen] = useState<ScreenId>(initialNav.screen);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(initialNav.selectedUnit);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const syncUrl = (newScreen: ScreenId, newUnit: string | null, replace = false) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (newScreen !== "overview" || newUnit) {
      params.set("screen", newScreen);
    }
    if (newUnit) {
      params.set("unit", newUnit);
    }
    const queryString = params.toString();
    const newUrl = queryString ? `?${queryString}` : window.location.pathname;
    if (replace) {
      window.history.replaceState({ screen: newScreen, unit: newUnit }, "", newUrl);
    } else {
      window.history.pushState({ screen: newScreen, unit: newUnit }, "", newUrl);
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const { screen: s, selectedUnit: u } = getInitialNavState();
      setScreen(s);
      setSelectedUnit(u);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const [modes, setModes] = useState<Mode[]>(initialModes);
  const [incubators, setIncubators] = useState<Incubator[]>(
    initialIncubators,
  );
  const [account, setAccount] =
    useState<Account>(initialAccount);

  const [alerts, setAlerts] =
    useState<AlertEntry[]>(initialAlerts);
  const [hatchRecords, setHatchRecords] = useState<HatchRecord[]>(() => [...hatchHistory]);

  const updateAccount = (patch: Partial<Account>) => {
    setAccount((prev) => ({ ...prev, ...patch }));
  };

  const acknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a,
      ),
    );
  };

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const markAllAlertsRead = () => {
    setAlerts((prev) =>
      prev.map((a) => ({ ...a, acknowledged: true })),
    );
  };

  // "Clear All" only removes what's already been read, so nothing unseen is lost.
  const clearReadAlerts = () => {
    setAlerts((prev) => prev.filter((a) => !a.acknowledged));
  };

  const refreshHatchHistory = () => {
    setHatchRecords([...hatchHistory]);
  };

  const unreadAlerts = alerts.filter(
    (a) => !a.acknowledged,
  ).length;

  const openUnit = (id: string) => {
    setSelectedUnit(id);
    setScreen("detail");
    syncUrl("detail", id);
  };

  const openTrendsForUnit = (id: string) => {
    setSelectedUnit(id);
    setScreen("trends");
    syncUrl("trends", id);
  };

  const navigate = (id: ScreenId) => {
    setSelectedUnit(null);
    setScreen(id);
    syncUrl(id, null);
  };

  const updateIncubator = (
    id: string,
    patch: Partial<Incubator>,
  ) => {
    setIncubators((prev) =>
      prev.map((u) => {
        if (u.id !== id) return u;
        const next = { ...u, ...patch };
        const mode = modes.find((m) => m.id === next.modeId) ?? modes[0];
        const conditionSeverity = mode
          ? deriveConditionSeverity({
              paired: next.paired,
              temp: next.temp,
              targetTemp: mode.targetTemp,
              humidity: next.humidity,
              targetHumidity: mode.targetHumidity,
              waterOk: next.waterOk,
              batteryPct: next.batteryPct,
              powerSource: next.powerSource,
              nextTurn: next.nextTurn,
            })
          : next.conditionSeverity;
        const connectionState = patch.connectionState
          ?? (patch.paired !== undefined ? (next.paired ? "connected" : "offline") : next.connectionState);
        return {
          ...next,
          conditionSeverity,
          status: unitStatusFromConditionSeverity(conditionSeverity),
          connectionState,
        };
      }),
    );
  };

  const addIncubator = (unit: Incubator) => {
    setIncubators((prev) => [...prev, unit]);
  };

  const updateMode = (id: string, patch: Partial<Mode>) => {
    setModes((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
  };

  const addMode = (mode: Mode) => {
    setModes((prev) => [...prev, mode]);
  };

  const deleteMode = (id: string): boolean => {
    if (incubators.some((unit) => unit.modeId === id)) {
      toast.error("This mode is still assigned to an incubator.");
      return false;
    }
    setModes((prev) => prev.filter((m) => m.id !== id));
    return true;
  };

  const activeUnit =
    incubators.find((u) => u.id === selectedUnit) ??
    incubators[0];

  // Inline metadata pills for the Incubator Detail title row.
  const activeMode =
    modes.find((m) => m.id === activeUnit.modeId) ?? modes[0];
  const statusTone =
    activeUnit.status === "optimal"
      ? { fg: "#15803D", bg: "#DCFCE7", label: "Normal" }
      : { fg: "#B45309", bg: "#FEF3C7", label: "Needs Attention" };

  const detailBadges = (
    <>
      <span
        className="shrink-0 rounded-full px-3 py-1"
        style={{
          backgroundColor: "var(--brand-primary)",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Day {activeUnit.dayOfIncubation} of{" "}
        {activeMode.incubationDays}
      </span>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1"
        style={{
          backgroundColor: statusTone.bg,
          color: statusTone.fg,
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: statusTone.fg }}
        />
        {statusTone.label}
      </span>
    </>
  );

  const detailHeader = (
    <div className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1
          className="min-w-0 truncate"
          style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.25 }}
          title={activeUnit.name}
        >
          {activeUnit.name}
        </h1>
        {detailBadges}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4, marginTop: 4 }}>
        {activeMode.name}
      </p>
    </div>
  );

  // One header copy deck, so every screen reads the same way.
  const overviewName = resolveDisplayName(account) || "farmer";
  const headerCopy: Record<
    ScreenId,
    { title: string; subtitle: string }
  > = {
    overview: {
      title: `Good day, ${overviewName}!`,
      subtitle:
        "Here's what needs your attention across your incubation cycles.",
    },
    incubators: {
      title: "Incubators",
      subtitle:
        "Manage each chamber, assign a Mode, and open its full configuration.",
    },
    detail: {
      title: activeUnit.name,
      subtitle: `Device ${activeUnit.deviceId} · ${activeMode.name}`,
    },
    trends: {
      title: "Historical Trends",
      subtitle:
        "Track environmental history and past hatch performance.",
    },
    alerts: {
      title: "Alerts & Notifications",
      subtitle: "Everything that needed a look, newest first.",
    },
    settings: {
      title: "Settings",
      subtitle:
        "App settings: modes, notifications, and account.",
    },
  };

  return (
    <div
      className="min-h-screen w-full"
      style={{ backgroundColor: "#FAF6F0" }}
    >
      <AppSidebar
        active={screen}
        onNavigate={navigate}
        alertCount={unreadAlerts}
        account={account}
        collapsed={navCollapsed}
        onToggleCollapsed={() => setNavCollapsed((v) => !v)}
      />

      <main
        className={`transition-all duration-200 ${navCollapsed ? "lg:pl-16" : "lg:pl-64"}`}
      >
        <div
          className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 lg:px-8 lg:pb-20"
          style={{ paddingTop: 24 }}
        >
          {/* Rows 1 and 2 — utility bar and page title bar. */}
          <div style={{ marginBottom: 20 }}>
            <PageHeader
              title={headerCopy[screen].title}
              subtitle={headerCopy[screen].subtitle}
              alertCount={unreadAlerts}
              onViewAlerts={() => navigate("alerts")}
              alerts={alerts}
              onMarkAllRead={markAllAlertsRead}
              onDismissAlert={dismissAlert}
              onBack={
                screen === "detail"
                  ? () => navigate("incubators")
                  : undefined
              }
              backLabel="Back to Incubators"
              badges={
                screen === "detail" ? detailBadges : undefined
              }
              titleNode={screen === "detail" ? detailHeader : undefined}
              showDateTime={screen === "overview"}
            />
          </div>

          {screen === "overview" && (
            <OverviewScreen
              units={incubators}
              modes={modes}
              onOpenUnit={openUnit}
              onManageAll={() => navigate("incubators")}
            />
          )}
          {screen === "incubators" && (
            <IncubatorsScreen
              units={incubators}
              modes={modes}
              onOpenUnit={openUnit}
              onAddIncubator={addIncubator}
              onUpdateUnit={updateIncubator}
              onHistoryChanged={refreshHatchHistory}
            />
          )}
          {screen === "detail" && (
            <Suspense fallback={<SuspenseFallback label="Loading incubator..." />}>
              <DetailScreen
                unit={activeUnit}
                modes={modes}
                onOpenTrends={() => openTrendsForUnit(activeUnit.id)}
                onHistoryChanged={refreshHatchHistory}
                onUpdate={(patch) => updateIncubator(activeUnit.id, patch)}
              />
            </Suspense>
          )}
          {screen === "trends" && (
            <Suspense fallback={<SuspenseFallback label="Loading trends..." />}>
              <TrendsScreen
                units={incubators}
                modes={modes}
                history={hatchRecords}
                initialUnitId={selectedUnit ?? undefined}
              />
            </Suspense>
          )}
          {screen === "alerts" && (
            <AlertsScreen
              alerts={alerts}
              onAcknowledge={acknowledgeAlert}
              onDismiss={dismissAlert}
              onMarkAllRead={markAllAlertsRead}
              onClearRead={clearReadAlerts}
              onOpenUnit={(unitName) => {
                const target = incubators.find((u) => u.name === unitName);
                if (target) openUnit(target.id);
              }}
            />
          )}
          {screen === "settings" && (
            <SettingsScreen
              modes={modes}
              onUpdateMode={updateMode}
              onAddMode={addMode}
              onDeleteMode={deleteMode}
              account={account}
              onUpdateAccount={updateAccount}
              units={incubators}
            />
          )}
        </div>
      </main>

      <Toaster position="top-right" richColors />
      <HelpWidget />
    </div>
  );
}
