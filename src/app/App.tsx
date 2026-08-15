import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { AppSidebar, ScreenId } from "./components/AppSidebar";
import { PageHeader } from "./components/PageHeader";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { IncubatorsScreen } from "./components/screens/IncubatorsScreen";
import { DetailScreen } from "./components/screens/DetailScreen";
import { TrendsScreen } from "./components/screens/TrendsScreen";
import { AlertsScreen } from "./components/screens/AlertsScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
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
import { Account, initialAccount } from "./data/account";
import { cyclePhaseDisplayLabels, deriveConditionSeverity, unitStatusFromConditionSeverity } from "./domain/cycle";

export default function App() {
  const [screen, setScreen] = useState<ScreenId>("overview");
  const [selectedUnit, setSelectedUnit] = useState<
    string | null
  >(null);
  const [navCollapsed, setNavCollapsed] = useState(false);

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
  };

  const openTrendsForUnit = (id: string) => {
    setSelectedUnit(id);
    setScreen("trends");
  };

  const navigate = (id: ScreenId) => {
    setSelectedUnit(null);
    setScreen(id);
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
      ? { fg: "#15803D", bg: "#DCFCE7", label: "Optimal" }
      : activeUnit.status === "warning"
        ? { fg: "#B45309", bg: "#FEF3C7", label: "Needs Attention" }
        : { fg: "#B91C1C", bg: "#FEE2E2", label: "Urgent" };

  const detailBadges = (
    <>
      <span
        className="shrink-0 rounded-full px-3 py-1"
        style={{
          backgroundColor: "#C8623A",
          color: "#FFFFFF",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        Day {activeUnit.dayOfIncubation} of{" "}
        {activeMode.incubationDays}
      </span>
      <span
        className="shrink-0 rounded-full px-3 py-1"
        style={{
          backgroundColor: "#F2EEE5",
          color: "#5A4838",
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {cyclePhaseDisplayLabels[activeUnit.cyclePhase]}
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
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1
          className="min-w-0 truncate"
          style={{ fontSize: 24, fontWeight: 700, color: "#1A1A1A", lineHeight: 1.25 }}
          title={activeUnit.name}
        >
          {activeUnit.name}
        </h1>
        {detailBadges}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1A1A", lineHeight: 1.4, marginTop: 4 }}>
        {activeMode.name}
      </p>
    </div>
  );

  // One header copy deck, so every screen reads the same way.
  const headerCopy: Record<
    ScreenId,
    { title: string; subtitle: string }
  > = {
    overview: {
      title: "Good day, farmer!",
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
            <DetailScreen
              unit={activeUnit}
              modes={modes}
              onOpenTrends={() => openTrendsForUnit(activeUnit.id)}
              onHistoryChanged={refreshHatchHistory}
              onUpdate={(patch) =>
                updateIncubator(activeUnit.id, patch)
              }
            />
          )}
          {screen === "trends" && (
            <TrendsScreen units={incubators} modes={modes} history={hatchRecords} initialUnitId={selectedUnit ?? undefined} />
          )}
          {screen === "alerts" && (
            <AlertsScreen
              alerts={alerts}
              onAcknowledge={acknowledgeAlert}
              onDismiss={dismissAlert}
              onMarkAllRead={markAllAlertsRead}
              onClearRead={clearReadAlerts}
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
    </div>
  );
}
