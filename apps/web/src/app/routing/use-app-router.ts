import { useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import type { DetailTab } from "../components/detail/types";
import {
  incubatorPath,
  legacyPathFromSearch,
  onboardingPath,
  parseAppPath,
  type ScreenId,
  screenPath,
  trendsPath,
  validateRouteIncubator,
} from "./routes";
import { useRoutePresentation } from "./use-route-presentation";

export function useAppRouter(validIncubatorIds?: readonly string[]) {
  const [pathname, navigate] = useLocation();
  const { prepareNavigation } = useRoutePresentation(pathname);
  const go = (target: string, replace = false, restoreList = false) =>
    navigate(target, {
      replace: replace || target === pathname,
      state: prepareNavigation(target, restoreList),
    });
  const search = useSearch();
  const legacyTarget = pathname === "/" ? legacyPathFromSearch(search) : null;
  const parsedRoute = useMemo(
    () => parseAppPath(legacyTarget ?? pathname),
    [legacyTarget, pathname],
  );
  const route = useMemo(
    () =>
      validIncubatorIds
        ? validateRouteIncubator(parsedRoute, validIncubatorIds)
        : parsedRoute,
    [parsedRoute, validIncubatorIds],
  );
  const canonicalTarget = legacyTarget ?? route.redirectTo;

  useEffect(() => {
    if (
      canonicalTarget &&
      `${pathname}${search ? `?${search}` : ""}` !== canonicalTarget
    ) {
      navigate(canonicalTarget, { replace: true });
    }
  }, [canonicalTarget, navigate, pathname, search]);

  return {
    ...route,
    navigateToScreen: (screen: ScreenId, replace = false) =>
      go(screenPath(screen), replace),
    returnToIncubators: () => go("/incubators", false, true),
    openIncubator: (id: string, tab: DetailTab = "monitor", replace = false) =>
      go(incubatorPath(id, tab), replace),
    openTrends: (id?: string | null, replace = false) =>
      go(trendsPath(id), replace),
    openOnboarding: (step: number, replace = false) =>
      go(onboardingPath(step), replace),
    openLogin: (replace = false) => go("/login", replace),
    openRegister: (replace = false) => go("/register", replace),
  };
}
