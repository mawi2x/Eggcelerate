import { TemperatureUnitContext } from "./providers/temperature-context";
import { lazy, Suspense, useState } from "react";
import { toast } from "sonner";
import { Redirect, useLocation } from "wouter";
import { AppSidebar } from "./components/AppSidebar";
import { ErrorPage } from "./components/ErrorPage";
import { EmptyState } from "./components/EmptyState";
import { FarmDataStatus } from "./components/FarmDataStatus";
import { FeatureDataStatus } from "./components/FeatureDataStatus";
import { HelpWidget } from "./components/HelpWidget";
import { PageHeader } from "./components/PageHeader";
import { RecoveryBoundary } from "./components/RecoveryBoundary";
import { SuspenseFallback } from "./components/SuspenseFallback";
import { OverviewScreen } from "./components/screens/OverviewScreen";
import { Button } from "./components/ui/button";
import { Toaster } from "./components/ui/sonner";
import { initialAccount, resolveDisplayName } from "./data/account";
import { repositoryErrorMessage } from "./features/farm/repository-query";
import { useFarmActions, useFarmData } from "./features/farm/use-farm-data";
import { useFetchNotifications } from "./features/farm/use-fetch-notifications";
import { useNotificationSounds } from "./features/farm/use-notification-sounds";
import { RequireAuth, useAuth } from "./providers/auth-context";
import {
  AlertsScreen,
  CandlingLogsScreen,
  DetailScreen,
  IncubatorsScreen,
  retryLazyScreens,
  SettingsScreen,
  SignInScreen,
  TrendsScreen,
} from "./routing/lazy-screens";
import { parseAppPath, type ScreenId } from "./routing/routes";
import { useAppRouter } from "./routing/use-app-router";

const AdminPage = lazy(() =>
  import("./components/admin/AdminPage").then((module) => ({
    default: module.AdminPage,
  })),
);

export default function App() {
  const [pathname] = useLocation();
  return (
    <RecoveryBoundary scope="app" onRetry={retryLazyScreens}>
      <Suspense fallback={<SuspenseFallback label="Loading screen..." />}>
        {pathname === "/admin" || pathname.startsWith("/admin/") ? (
          <AdminPage />
        ) : (
          <AppContent />
        )}
      </Suspense>
    </RecoveryBoundary>
  );
}

function AppContent() {
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const auth = useAuth();
  const [pathname] = useLocation();

  const {
    modes,
    incubators,
    alerts: farmAlerts,
    hatchRecords,
    settings,
    features,
    isLoading: farmDataLoading,
    staleError: farmDataStaleError,
    error: farmDataError,
    retry: retryFarmData,
  } = useFarmData(parseAppPath(pathname).screen === "trends");
  const {
    acknowledgeAlert: acknowledgeFarmAlert,
    dismissAlert: dismissFarmAlert,
    markAllAlertsRead: markAllFarmAlertsRead,
    clearReadAlerts: clearReadFarmAlerts,
    updateIncubator,
    requestTurn,
    addIncubator,
    updateMode,
    addMode,
    deleteMode,
    saveSettings,
    actionState,
  } = useFarmActions();
  const fetchNotifications = useFetchNotifications();
  useNotificationSounds(
    auth.isAuthenticated ? `${auth.user?.id}:${auth.user?.email}` : null,
    farmAlerts,
    features.alerts.hasData,
    fetchNotifications.notifications,
  );
  const alerts = [...fetchNotifications.notifications, ...farmAlerts].sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
  const acknowledgeAlert = async (id: string) => {
    if (!fetchNotifications.isLocal(id)) return acknowledgeFarmAlert(id);
    fetchNotifications.acknowledge(id);
    return true;
  };
  const dismissAlert = async (id: string) => {
    if (!fetchNotifications.isLocal(id)) return dismissFarmAlert(id);
    fetchNotifications.dismiss(id);
    return true;
  };
  const markAllAlertsRead = async () => {
    fetchNotifications.markAllRead();
    return farmAlerts.some((entry) => !entry.acknowledged)
      ? markAllFarmAlertsRead()
      : true;
  };
  const clearReadAlerts = async () => {
    fetchNotifications.clearRead();
    return farmAlerts.some((entry) => entry.acknowledged)
      ? clearReadFarmAlerts()
      : true;
  };
  const account = features.settings.hasData
    ? settings.account
    : {
        ...initialAccount,
        displayName: auth.user?.displayName ?? initialAccount.displayName,
      };
  const { signIn, isAuthenticated } = auth;
  const {
    screen,
    selectedUnit,
    detailTab,
    navigateToScreen: navigate,
    returnToIncubators,
    openIncubator,
    openTrends,
  } = useAppRouter(
    farmDataLoading ? undefined : incubators.map((unit) => unit.id),
  );

  const unreadAlerts = alerts.filter((a) => !a.acknowledged).length;

  const openUnit = (id: string) => openIncubator(id);
  const openCandling = (id: string) => openIncubator(id, "candling");
  const openTrendsForUnit = (id: string) => openTrends(id);

  if (auth.isLoading) {
    return <SuspenseFallback label="Checking sign-in session..." />;
  }

  // Accounts and farms are provisioned by the administrator in both modes.
  if (screen === "register" || screen === "onboarding") {
    return <Redirect to={isAuthenticated ? "/" : "/login"} replace />;
  }
  if (screen === "login") {
    if (isAuthenticated && auth.mode === "api") {
      return <Redirect to="/" replace />;
    }
    return (
      <>
        <SignInScreen
          onSignIn={async (email, password, rememberMe) => {
            await signIn(email, password, rememberMe);
            navigate("overview", true);
          }}
          canRegister={false}
          authError={auth.error}
        />
        <Toaster position="top-right" richColors />
      </>
    );
  }
  if (!isAuthenticated) {
    return (
      <RequireAuth>
        <SuspenseFallback label="Redirecting to sign in..." />
      </RequireAuth>
    );
  }

  if (screen === "notFound") {
    return (
      <RequireAuth>
        <div
          className="min-h-dvh w-full overflow-x-clip"
          style={{ backgroundColor: "var(--surface-app)" }}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-card)] focus:px-4 focus:py-3 focus:text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--ring)]"
          >
            Skip to content
          </a>
          <AppSidebar
            active={screen}
            onNavigate={navigate}
            alertCount={unreadAlerts}
            account={account}
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed((value) => !value)}
            onSignOut={() => void signOutAndReturn()}
            onHelp={() => setHelpOpen(true)}
          />
          <main
            id="main-content"
            tabIndex={-1}
            className={`transition-all duration-200 ${navCollapsed ? "md:pl-16" : "md:pl-64"}`}
          >
            <div className="mx-auto flex min-h-dvh w-full max-w-6xl items-center px-3 pt-6 pb-[var(--mobile-bottom-nav-clearance)] sm:px-4 md:px-6 md:py-6 lg:px-8">
              <ErrorPage kind="not-found" onHome={() => navigate("overview")} />
            </div>
          </main>
          <Toaster position="top-right" richColors />
          <HelpWidget open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
      </RequireAuth>
    );
  }

  if (farmDataError) {
    const errorHeader = (
      <PageHeader
        title={
          screen === "alerts" ? "Notifications" : "Unable to load farm data"
        }
        subtitle="Check your connection and try again."
        alertCount={unreadAlerts}
        alerts={alerts}
        alertsStatus={features.alerts}
        onViewAlerts={() => navigate("alerts")}
        onMarkAllRead={markAllAlertsRead}
        onDismissAlert={dismissAlert}
        pendingAlertId={actionState.pendingAlertId}
        markingAllRead={actionState.markingAllAlertsRead}
        onBack={screen === "alerts" ? () => navigate("overview") : undefined}
        backLabel="Back to dashboard"
      />
    );
    return (
      <main
        tabIndex={-1}
        className="mx-auto min-h-dvh max-w-3xl space-y-5 px-4 py-6"
      >
        {screen === "alerts" ? (
          <Suspense
            fallback={<SuspenseFallback label="Loading notifications..." />}
          >
            <AlertsScreen
              alerts={alerts}
              hasIncubators={farmDataError ? true : incubators.length > 0}
              dataStatus={features.alerts}
              onAcknowledge={acknowledgeAlert}
              onDismiss={dismissAlert}
              onMarkAllRead={markAllAlertsRead}
              onClearRead={clearReadAlerts}
              pendingAlertId={actionState.pendingAlertId}
              markingAllRead={actionState.markingAllAlertsRead}
              clearingRead={actionState.clearingReadAlerts}
              header={errorHeader}
            />
          </Suspense>
        ) : (
          errorHeader
        )}
        <div role="alert" className="space-y-3">
          <p style={{ color: "var(--text-secondary)" }}>
            {repositoryErrorMessage(farmDataError)}
          </p>
          <Button type="button" onClick={() => void retryFarmData()}>
            <span>Try again</span>
          </Button>
        </div>
        <Toaster position="top-right" richColors />
      </main>
    );
  }
  if (farmDataLoading) {
    return <SuspenseFallback label="Loading farm data..." />;
  }
  if (modes.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-3xl items-center px-4 py-8">
        <EmptyState
          size="page"
          title="No farm data available"
          description="The current data source did not return both incubation modes and incubators."
          action={
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => void retryFarmData()}
            >
              <span>Reload data</span>
            </Button>
          }
        />
      </div>
    );
  }
  if (screen === "detail" && incubators.length === 0) {
    return <Redirect to="/incubators" replace />;
  }

  const activeUnit =
    incubators.find((u) => u.id === selectedUnit) ?? incubators[0];

  // Inline metadata pills for the Incubator Detail title row.
  const activeMode = modes.find((m) => m.id === activeUnit?.modeId) ?? modes[0];
  const statusTone =
    activeUnit?.status === "optimal"
      ? {
          fg: "var(--status-success-fg)",
          bg: "var(--status-success-bg)",
          label: "All Systems Optimal",
        }
      : {
          fg: "var(--status-warning-fg)",
          bg: "var(--status-warning-bg)",
          label: "Needs Attention",
        };

  const detailHeader =
    activeUnit && activeMode ? (
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 md:flex md:flex-wrap">
        <h1
          className="min-w-0 max-w-full break-words md:basis-auto"
          style={{
            fontSize: "var(--type-heading-md)",
            fontWeight: "var(--weight-bold)",
            color: "var(--text-primary)",
            lineHeight: 1.25,
            overflowWrap: "anywhere",
          }}
          title={activeUnit.name}
        >
          {activeUnit.name}
        </h1>
        <span
          className="shrink-0 justify-self-end rounded-full px-3 py-1"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--on-brand)",
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {activeUnit.cyclePhase === "ready"
            ? activeUnit.preparationStartedAt
              ? activeUnit.preparationReady
                ? "Ready to load"
                : "Preparing"
              : "Idle"
            : `Day ${activeUnit.dayOfIncubation} of ${activeMode.incubationDays}`}
        </span>
        <p
          className="min-w-0 max-w-full break-words md:order-3 md:mt-1 md:basis-full"
          style={{
            fontSize: "var(--type-heading-sm)",
            fontWeight: "var(--weight-semibold)",
            color: "var(--text-primary)",
            lineHeight: 1.4,
            overflowWrap: "anywhere",
          }}
        >
          {activeUnit.cyclePhase === "ready" && !activeUnit.preparationStartedAt
            ? "Unassigned"
            : activeMode.name}
        </p>
        <span
          className="inline-flex shrink-0 items-center justify-self-end gap-1.5 rounded-full px-3 py-1"
          style={{
            backgroundColor: statusTone.bg,
            color: statusTone.fg,
            fontSize: "var(--type-body-sm)",
            fontWeight: "var(--weight-bold)",
          }}
        >
          {statusTone.label}
        </span>
      </div>
    ) : undefined;

  // One header copy deck, so every screen reads the same way.
  const overviewName = resolveDisplayName(account) || "farmer";
  const headerCopy: Record<ScreenId, { title: string; subtitle: string }> = {
    overview: {
      title: `Good day, ${overviewName}!`,
      subtitle: "Eggcelerate! It's hatching time!",
    },
    incubators: {
      title: "Incubators",
      subtitle:
        incubators.length === 0
          ? "Add your first real chamber to this farm."
          : "Manage and monitor your incubators.",
    },
    candling: {
      title: "Candling Logs",
      subtitle: "Your candling journals",
    },
    detail: {
      title: activeUnit?.name ?? "Incubator",
      subtitle:
        activeUnit && activeMode
          ? `Device ${activeUnit.deviceId} (${activeMode.name})`
          : "Select an incubator to monitor.",
    },
    trends: {
      title: "Historical Trends",
      subtitle: "Track environment and performance.",
    },
    alerts: {
      title: "Notification Center",
      subtitle: "Recent activity and alerts.",
    },
    settings: {
      title: "Settings",
      subtitle: "Modes, alerts, and farm setup",
    },
    login: {
      title: "Sign in",
      subtitle: "Welcome back",
    },
    onboarding: {
      title: "Onboarding",
      subtitle: "Set up your farm",
    },
    register: {
      title: "Create account",
      subtitle: "Set up your farm account",
    },
    notFound: {
      title: "Page not found",
      subtitle: "The page you requested could not be found.",
    },
  };

  async function signOutAndReturn() {
    try {
      await auth.signOut();
      navigate("login", true);
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Sign out could not be completed.",
      );
    }
  }

  // Routes whose screen owns the header inside its sticky toolbar.
  const headerInScreen =
    screen === "candling" ||
    screen === "incubators" ||
    screen === "alerts" ||
    screen === "trends" ||
    screen === "settings";

  // Single PageHeader node: the shell renders it directly, except on routes
  // whose screen places it inside its own sticky toolbar (see headerInScreen).
  const pageHeader = (
    <PageHeader
      title={headerCopy[screen].title}
      subtitle={headerCopy[screen].subtitle}
      titleHighlight={screen === "overview" ? `${overviewName}!` : undefined}
      alertCount={unreadAlerts}
      onViewAlerts={() => navigate("alerts")}
      alertsStatus={features.alerts}
      alerts={alerts}
      onMarkAllRead={markAllAlertsRead}
      onDismissAlert={dismissAlert}
      pendingAlertId={actionState.pendingAlertId}
      markingAllRead={actionState.markingAllAlertsRead}
      onBack={screen === "detail" ? returnToIncubators : undefined}
      backLabel="Back to Incubators"
      titleNode={screen === "detail" ? detailHeader : undefined}
      showDateTime={screen === "overview"}
    />
  );

  return (
    <RequireAuth>
      <TemperatureUnitContext.Provider value={settings.temperatureUnit}>
        <div
          className="min-h-dvh w-full overflow-x-clip"
          style={{ backgroundColor: "var(--surface-app)" }}
        >
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-lg focus:bg-[var(--surface-card)] focus:px-4 focus:py-3 focus:text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--ring)]"
          >
            Skip to content
          </a>
          <AppSidebar
            active={screen}
            onNavigate={navigate}
            alertCount={unreadAlerts}
            account={account}
            collapsed={navCollapsed}
            onToggleCollapsed={() => setNavCollapsed((v) => !v)}
            onSignOut={() => void signOutAndReturn()}
            onHelp={() => setHelpOpen(true)}
          />

          <main
            id="main-content"
            tabIndex={-1}
            className={`transition-all duration-200 ${navCollapsed ? "md:pl-16" : "md:pl-64"}`}
          >
            <div
              className="mx-auto max-w-6xl px-3 pb-44 sm:px-4 sm:pb-28 md:px-6 lg:px-8 lg:pb-20"
              // Sticky-toolbar routes carry their own top spacing inside the toolbar so the
              // resting and stuck states share the same gap (no jump on scroll).
              style={{ paddingTop: headerInScreen ? 0 : 24 }}
            >
              {/* Rows 1 and 2 — utility bar and page title bar. */}
              {!headerInScreen && (
                <div className={screen === "detail" ? "mb-2 md:mb-5" : "mb-5"}>
                  {pageHeader}
                </div>
              )}

              <FarmDataStatus
                staleError={farmDataStaleError}
                onRetry={() => void retryFarmData()}
              />

              <RecoveryBoundary
                key={`${screen}:${selectedUnit ?? ""}`}
                scope="screen"
                onRetry={retryLazyScreens}
              >
                {screen === "overview" && incubators.length === 0 && (
                  <EmptyState
                    size="page"
                    title="No incubators yet"
                    description="Add an incubator using its pairing code to begin monitoring your farm."
                    action={
                      <Button
                        className="rounded-xl"
                        onClick={() => navigate("incubators")}
                      >
                        Add your first incubator
                      </Button>
                    }
                  />
                )}
                {screen === "overview" && incubators.length > 0 && (
                  <OverviewScreen
                    units={incubators}
                    modes={modes}
                    alerts={alerts}
                    onOpenUnit={openUnit}
                    onManageAll={() => navigate("incubators")}
                  />
                )}
                {screen === "incubators" && (
                  <Suspense
                    fallback={
                      <SuspenseFallback label="Loading incubators..." />
                    }
                  >
                    <IncubatorsScreen
                      units={incubators}
                      modes={modes}
                      onOpenUnit={openUnit}
                      onAddIncubator={addIncubator}
                      isAddingIncubator={actionState.addingIncubator}
                      header={pageHeader}
                    />
                  </Suspense>
                )}
                {screen === "candling" && (
                  <Suspense
                    fallback={
                      <SuspenseFallback label="Loading candling logs..." />
                    }
                  >
                    <CandlingLogsScreen
                      units={incubators}
                      modes={modes}
                      onOpenCandling={openCandling}
                      header={pageHeader}
                    />
                  </Suspense>
                )}
                {screen === "detail" && activeUnit && (
                  <Suspense
                    fallback={<SuspenseFallback label="Loading incubator..." />}
                  >
                    <DetailScreen
                      unit={activeUnit}
                      modes={modes}
                      initialTab={detailTab}
                      onDeleted={() => navigate("incubators")}
                      onOpenTrends={() => openTrendsForUnit(activeUnit.id)}
                      onTabChange={(tab) =>
                        openIncubator(activeUnit.id, tab, true)
                      }
                      onUpdate={(intent) =>
                        updateIncubator(activeUnit.id, intent)
                      }
                      onRequestTurn={() => requestTurn(activeUnit.id)}
                      isUpdating={
                        actionState.updatingIncubatorId === activeUnit.id
                      }
                      isRequestingTurn={
                        actionState.requestingTurnIncubatorId === activeUnit.id
                      }
                    />
                  </Suspense>
                )}
                {screen === "trends" && (
                  <Suspense
                    fallback={<SuspenseFallback label="Loading trends..." />}
                  >
                    <TrendsScreen
                      units={incubators}
                      modes={modes}
                      history={hatchRecords}
                      historyStatus={features.history}
                      initialUnitId={selectedUnit ?? undefined}
                      header={pageHeader}
                    />
                  </Suspense>
                )}
                {screen === "alerts" && (
                  <Suspense
                    fallback={
                      <SuspenseFallback label="Loading notifications..." />
                    }
                  >
                    <AlertsScreen
                      alerts={alerts}
                      hasIncubators={
                        farmDataError ? true : incubators.length > 0
                      }
                      dataStatus={features.alerts}
                      onAcknowledge={acknowledgeAlert}
                      onDismiss={dismissAlert}
                      onMarkAllRead={markAllAlertsRead}
                      onClearRead={clearReadAlerts}
                      pendingAlertId={actionState.pendingAlertId}
                      markingAllRead={actionState.markingAllAlertsRead}
                      clearingRead={actionState.clearingReadAlerts}
                      onOpenUnit={(unitName) => {
                        const target = incubators.find(
                          (u) => u.name === unitName,
                        );
                        if (target) openUnit(target.id);
                      }}
                      header={pageHeader}
                    />
                  </Suspense>
                )}
                {screen === "settings" && (
                  <>
                    {!features.settings.hasData && pageHeader}
                    <FeatureDataStatus
                      label="Settings"
                      state={features.settings}
                    />
                    {features.settings.hasData && (
                      <Suspense
                        fallback={
                          <SuspenseFallback label="Loading settings..." />
                        }
                      >
                        <SettingsScreen
                          onChangePassword={auth.mode === "api" ? auth.changePassword : undefined}
                          modes={modes}
                          onUpdateMode={updateMode}
                          onAddMode={addMode}
                          onDeleteMode={deleteMode}
                          settings={settings}
                          onSaveSettings={saveSettings}
                          isSaving={actionState.savingSettings}
                          units={incubators}
                          onOpenUnit={openUnit}
                          header={pageHeader}
                        />
                      </Suspense>
                    )}
                  </>
                )}
              </RecoveryBoundary>
            </div>
          </main>

          <Toaster position="top-right" richColors />
          <HelpWidget open={helpOpen} onOpenChange={setHelpOpen} />
        </div>
      </TemperatureUnitContext.Provider>
    </RequireAuth>
  );
}
