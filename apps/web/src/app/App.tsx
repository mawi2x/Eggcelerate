import { useState, lazy, Suspense } from "react";
import { toast } from "sonner";
import { Toaster } from "./components/ui/sonner";
import { AppSidebar } from "./components/AppSidebar";
import { PageHeader } from "./components/PageHeader";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { IncubatorsScreen } from "./components/screens/IncubatorsScreen";
import { AlertsScreen } from "./components/screens/AlertsScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { HelpWidget } from "./components/HelpWidget";
import { SuspenseFallback } from "./components/SuspenseFallback";
import { FarmDataStatus } from "./components/FarmDataStatus";
import { Button } from "./components/ui/button";
import { SignInScreen } from "./components/auth/SignInScreen";
import { OnboardingStep1 } from "./components/auth/OnboardingStep1";
import { defaultOnboarding, OnboardingState } from "./data/onboarding";

const DetailScreen = lazy(() =>
  import("./components/screens/DetailScreen").then((m) => ({ default: m.DetailScreen })),
);
const TrendsScreen = lazy(() =>
  import("./components/screens/TrendsScreen").then((m) => ({ default: m.TrendsScreen })),
);
const CandlingLogsScreen = lazy(() =>
  import("./components/screens/CandlingLogsScreen").then((m) => ({ default: m.CandlingLogsScreen })),
);
const OnboardingStep2 = lazy(() =>
  import("./components/auth/OnboardingStep2").then((m) => ({ default: m.OnboardingStep2 })),
);
const OnboardingStep3 = lazy(() =>
  import("./components/auth/OnboardingStep3").then((m) => ({ default: m.OnboardingStep3 })),
);
import { initialAccount, resolveDisplayName } from "./data/account";
import { CURRENT_TRAY_CAPACITY } from "./domain/candling";
import type { Incubator } from "./domain/types";
import { repositoryErrorMessage } from "./features/farm/repository-query";
import { useFarmActions, useFarmData } from "./features/farm/use-farm-data";
import { RequireAuth, useAuth } from "./providers/auth-context";
import type { ScreenId } from "./routing/routes";
import { useAppRouter } from "./routing/use-app-router";

export default function App() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(defaultOnboarding);

  const {
    modes,
    incubators,
    alerts,
    hatchRecords,
    settings,
    isLoading: farmDataLoading,
    isRefreshing: farmDataRefreshing,
    staleError: farmDataStaleError,
    error: farmDataError,
    retry: retryFarmData,
  } = useFarmData();
  const {
    acknowledgeAlert,
    dismissAlert,
    markAllAlertsRead,
    clearReadAlerts,
    updateIncubator,
    addIncubator,
    updateMode,
    addMode,
    deleteMode,
    saveSettings,
    actionState,
  } = useFarmActions();
  const account = settings.account;
  const { signIn, completeOnboarding, isAuthenticated } = useAuth();
  const {
    screen,
    selectedUnit,
    detailTab,
    onboardingStep,
    navigateToScreen: navigate,
    openIncubator,
    openTrends,
    openOnboarding,
    openLogin,
  } = useAppRouter(farmDataLoading ? undefined : incubators.map((unit) => unit.id));

  const unreadAlerts = alerts.filter(
    (a) => !a.acknowledged,
  ).length;

  const openUnit = (id: string) => openIncubator(id);
  const openCandling = (id: string) => openIncubator(id, "candling");
  const openTrendsForUnit = (id: string) => openTrends(id);

  // Mock auth routes stay available even if farm-data hydration is unavailable.
  if (screen === "login") {
    return (
      <>
        <SignInScreen
          onSignIn={() => {
            signIn();
            navigate("overview");
          }}
          onSetup={() => openOnboarding(1)}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }
  if (screen === "onboarding" && onboardingStep === 1) {
    return (
      <>
        <OnboardingStep1
          onContinue={(data) => {
            setOnboardingState((prev) => ({ ...prev, ...data }));
            openOnboarding(2);
          }}
          onHaveAccount={() => openLogin()}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }
  if (screen === "onboarding" && onboardingStep === 2) {
    return (
      <Suspense fallback={<SuspenseFallback label="Loading onboarding..." />}>
        <OnboardingStep2
          onContinue={(data) => {
            setOnboardingState((prev) => ({ ...prev, ...data }));
            openOnboarding(3);
          }}
          onBack={() => openOnboarding(1)}
          onHaveAccount={() => openLogin()}
        />
        <Toaster position="top-right" richColors />
      </Suspense>
    );
  }
  if (!isAuthenticated && screen !== "onboarding") {
    return (
      <RequireAuth>
        <SuspenseFallback label="Redirecting to sign in..." />
      </RequireAuth>
    );
  }

  if (farmDataError) {
    return (
      <div
        className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center"
        role="alert"
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            Unable to load farm data
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            {repositoryErrorMessage(farmDataError)}
          </p>
        </div>
        <Button type="button" onClick={() => void retryFarmData()}>
          Try again
        </Button>
      </div>
    );
  }
  if (farmDataLoading) {
    return <SuspenseFallback label="Loading farm data..." />;
  }
  if (modes.length === 0 || incubators.length === 0) {
    return (
      <div
        className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-6 text-center"
        role="status"
      >
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>
            No farm data available
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
            The current data source did not return both incubation modes and incubators.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void retryFarmData()}>
          Reload data
        </Button>
      </div>
    );
  }

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
    candling: {
      title: "Candling Logs",
      subtitle:
        "Review inspection progress and upcoming checks across all of your chambers.",
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
    login: {
      title: "Sign in",
      subtitle: "Welcome back",
    },
    onboarding: {
      title: "Onboarding",
      subtitle: "Set up your farm",
    },
  };

  if (screen === "onboarding") {
    return (
      <Suspense fallback={<SuspenseFallback label="Loading onboarding..." />}>
        <OnboardingStep3
          modes={modes}
          onEnter={async (data) => {
            setOnboardingState((prev) => ({ ...prev, ...data }));
            // set state then finish — use updated value directly for toast/name
            // merge data synchronously for finish
            const merged = { ...onboardingState, ...data };
            // update state and immediately finish with merged
            setOnboardingState(merged);
            // finish uses merged via closure? call inline to avoid stale
            // Instead duplicate finish logic with merged
            const mode = modes.find((m) => m.id === merged.startingModeId) ?? modes[0];
            const newIncubator: Incubator = {
              id: `chamber-${Date.now()}`,
              name: merged.chamberName,
              deviceId: `EGG-${String(Date.now()).slice(-4)}`,
              modeId: merged.startingModeId,
              dayOfIncubation: 1,
              totalEggsLoaded: CURRENT_TRAY_CAPACITY,
              temp: mode.targetTemp.min,
              humidity: mode.targetHumidity.min,
              waterOk: true,
              tempTrend: 0,
              humidityTrend: 0,
              powerSource: "grid",
              batteryPct: 100,
              status: "optimal",
              lastTurned: new Date().toISOString(),
              nextTurn: new Date(Date.now() + (mode.defaultTurnInterval ?? 4) * 3600000).toISOString(),
              turnInterval: mode.defaultTurnInterval ?? 4,
              autoTurn: true,
              paired: true,
              cyclePhase: "incubating",
              conditionSeverity: "info",
              connectionState: "connected",
              candled: {},
              candlingLog: [],
            };
            if (!await addIncubator(newIncubator)) return false;
            const accountSaved = await saveSettings({
              ...settings,
              account: {
                ...settings.account,
                accountHolder: merged.name || initialAccount.accountHolder,
                farmName: merged.farmName || initialAccount.farmName,
              },
            });
            if (!accountSaved) return false;
            completeOnboarding();
            toast.success(`Welcome to Eggcelerate, ${merged.name.split(" ")[0] || "farmer"}!`);
            navigate("overview");
            return true;
          }}
          onBack={() => openOnboarding(2)}
          onHaveAccount={() => openLogin()}
        />
        <Toaster position="top-right" richColors />
      </Suspense>
    );
  }

  return (
    <RequireAuth>
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
        className={`transition-all duration-200 ${navCollapsed ? "md:pl-16" : "md:pl-64"}`}
      >
        <div
          className="mx-auto max-w-6xl px-4 pb-44 sm:px-6 sm:pb-28 lg:px-8 lg:pb-20"
          style={{ paddingTop: 24 }}
        >
          {/* Rows 1 and 2 — utility bar and page title bar. */}
          <div style={{ marginBottom: 20 }}>
            <PageHeader
              title={headerCopy[screen].title}
              subtitle={headerCopy[screen].subtitle}
              titleHighlight={screen === "overview" ? `${overviewName}!` : undefined}
              alertCount={unreadAlerts}
              onViewAlerts={() => navigate("alerts")}
              alerts={alerts}
              onMarkAllRead={markAllAlertsRead}
              onDismissAlert={dismissAlert}
              pendingAlertId={actionState.pendingAlertId}
              markingAllRead={actionState.markingAllAlertsRead}
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

          <FarmDataStatus
            isRefreshing={farmDataRefreshing}
            staleError={farmDataStaleError}
            onRetry={() => void retryFarmData()}
          />

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
              isAddingIncubator={actionState.addingIncubator}
            />
          )}
          {screen === "candling" && (
            <Suspense fallback={<SuspenseFallback label="Loading candling logs..." />}>
              <CandlingLogsScreen
                units={incubators}
                modes={modes}
                onOpenCandling={openCandling}
              />
            </Suspense>
          )}
          {screen === "detail" && (
            <Suspense fallback={<SuspenseFallback label="Loading incubator..." />}>
              <DetailScreen
                unit={activeUnit}
                modes={modes}
                initialTab={detailTab}
                onOpenTrends={() => openTrendsForUnit(activeUnit.id)}
                onTabChange={(tab) => openIncubator(activeUnit.id, tab)}
                onUpdate={(patch) => updateIncubator(activeUnit.id, patch)}
                isUpdating={actionState.updatingIncubatorId === activeUnit.id}
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
              pendingAlertId={actionState.pendingAlertId}
              markingAllRead={actionState.markingAllAlertsRead}
              clearingRead={actionState.clearingReadAlerts}
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
              settings={settings}
              onSaveSettings={saveSettings}
              isSaving={actionState.savingSettings}
              units={incubators}
            />
          )}
        </div>
      </main>

      <Toaster position="top-right" richColors />
      <HelpWidget />
      </div>
    </RequireAuth>
  );
}
