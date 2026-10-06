import type { DetailTab } from "../components/detail/types";

export type ScreenId =
  | "overview"
  | "incubators"
  | "candling"
  | "detail"
  | "trends"
  | "alerts"
  | "settings"
  | "login"
  | "register"
  | "onboarding"
  | "notFound";

export interface AppRouteState {
  screen: ScreenId;
  selectedUnit: string | null;
  detailTab: DetailTab;
  onboardingStep: 1 | 2 | 3;
  redirectTo?: string;
}

const defaultRoute = (): AppRouteState => ({
  screen: "overview",
  selectedUnit: null,
  detailTab: "monitor",
  onboardingStep: 1,
});

const validDetailTabs = new Set<DetailTab>(["monitor", "candling", "settings"]);

function decodePathSegment(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value).trim();
    return decoded.length > 0 ? decoded : null;
  } catch {
    return null;
  }
}

export function incubatorPath(id: string, tab: DetailTab = "monitor"): string {
  const base = `/incubators/${encodeURIComponent(id)}`;
  return tab === "monitor" ? base : `${base}/${tab}`;
}

export function trendsPath(id?: string | null): string {
  return id ? `/trends/${encodeURIComponent(id)}` : "/trends";
}

export function onboardingPath(step: number): string {
  const safeStep = step === 2 || step === 3 ? step : 1;
  return `/onboarding/${safeStep}`;
}

export function screenPath(screen: ScreenId): string {
  switch (screen) {
    case "overview":
      return "/";
    case "incubators":
      return "/incubators";
    case "candling":
      return "/candling";
    case "trends":
      return "/trends";
    case "alerts":
      return "/alerts";
    case "settings":
      return "/settings";
    case "login":
      return "/login";
    case "register":
      return "/register";
    case "onboarding":
      return onboardingPath(1);
    case "notFound":
      return "/404";
    case "detail":
      return "/incubators";
  }
}

export function parseAppPath(pathname: string): AppRouteState {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  if (normalized === "/") return defaultRoute();
  if (normalized === "/incubators")
    return { ...defaultRoute(), screen: "incubators" };
  if (normalized === "/candling")
    return { ...defaultRoute(), screen: "candling" };
  if (normalized === "/trends") return { ...defaultRoute(), screen: "trends" };
  if (normalized === "/alerts") return { ...defaultRoute(), screen: "alerts" };
  if (normalized === "/settings")
    return { ...defaultRoute(), screen: "settings" };
  if (normalized === "/login") return { ...defaultRoute(), screen: "login" };
  if (normalized === "/register")
    return { ...defaultRoute(), screen: "register" };
  if (normalized === "/onboarding") {
    return {
      ...defaultRoute(),
      screen: "onboarding",
      redirectTo: onboardingPath(1),
    };
  }

  const segments = normalized.split("/").slice(1);
  if (
    segments[0] === "incubators" &&
    (segments.length === 2 || segments.length === 3)
  ) {
    const selectedUnit = decodePathSegment(segments[1]);
    const detailTab = (segments[2] ?? "monitor") as DetailTab;
    if (!selectedUnit)
      return {
        ...defaultRoute(),
        screen: "incubators",
        redirectTo: "/incubators",
      };
    if (!validDetailTabs.has(detailTab)) {
      return {
        ...defaultRoute(),
        screen: "detail",
        selectedUnit,
        redirectTo: incubatorPath(selectedUnit),
      };
    }
    return { ...defaultRoute(), screen: "detail", selectedUnit, detailTab };
  }
  if (segments[0] === "trends" && segments.length === 2) {
    const selectedUnit = decodePathSegment(segments[1]);
    if (!selectedUnit)
      return { ...defaultRoute(), screen: "trends", redirectTo: "/trends" };
    return { ...defaultRoute(), screen: "trends", selectedUnit };
  }
  if (segments[0] === "onboarding" && segments.length === 2) {
    const step = Number(segments[1]);
    if (step === 1 || step === 2 || step === 3) {
      return { ...defaultRoute(), screen: "onboarding", onboardingStep: step };
    }
    return {
      ...defaultRoute(),
      screen: "onboarding",
      redirectTo: onboardingPath(1),
    };
  }

  return { ...defaultRoute(), screen: "notFound" };
}

export function legacyPathFromSearch(search: string): string | null {
  const params = new URLSearchParams(search);
  const screen = params.get("screen") as ScreenId | null;
  if (!screen) return null;
  const unit = params.get("unit");
  const tab = params.get("tab") as DetailTab | null;
  const demoAuth = params.get("demo") === "onboarding";

  if (screen === "login") return demoAuth ? "/login" : null;
  if (screen === "onboarding") {
    return demoAuth ? onboardingPath(Number(params.get("step") ?? 1)) : null;
  }
  if (screen === "detail") {
    return unit
      ? incubatorPath(unit, tab && validDetailTabs.has(tab) ? tab : "monitor")
      : "/incubators";
  }
  if (screen === "trends") return trendsPath(unit);
  if (
    ["overview", "incubators", "candling", "alerts", "settings"].includes(
      screen,
    )
  ) {
    return screenPath(screen);
  }
  return null;
}

export function validateRouteIncubator(
  route: AppRouteState,
  validIncubatorIds: readonly string[],
): AppRouteState {
  if (!route.selectedUnit || validIncubatorIds.includes(route.selectedUnit))
    return route;
  if (route.screen === "trends") {
    return { ...route, selectedUnit: null, redirectTo: "/trends" };
  }
  return { ...defaultRoute(), screen: "incubators", redirectTo: "/incubators" };
}
