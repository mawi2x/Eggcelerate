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

export function useAppRouter(validIncubatorIds?: readonly string[]) {
  const [pathname, navigate] = useLocation();
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
      navigate(screenPath(screen), { replace }),
    openIncubator: (id: string, tab: DetailTab = "monitor", replace = false) =>
      navigate(incubatorPath(id, tab), { replace }),
    openTrends: (id?: string | null, replace = false) =>
      navigate(trendsPath(id), { replace }),
    openOnboarding: (step: number, replace = false) =>
      navigate(onboardingPath(step), { replace }),
    openLogin: (replace = false) => navigate("/login", { replace }),
    openRegister: (replace = false) => navigate("/register", { replace }),
  };
}
