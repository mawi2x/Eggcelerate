import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import { MockAuthProvider, RequireAuth } from "../app/providers/auth-context";
import {
  incubatorPath,
  legacyPathFromSearch,
  parseAppPath,
  type ScreenId,
  validateRouteIncubator,
} from "../app/routing/routes";
import { useAppRouter } from "../app/routing/use-app-router";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (check()) return;
    await act(async () => new Promise((resolve) => setTimeout(resolve, 5)));
  }
  throw new Error("Timed out waiting for routing state.");
}

describe("route contracts", () => {
  it("parses stable screen, unit, tab, and onboarding paths", () => {
    expect(parseAppPath("/").screen).toBe("overview");
    expect(parseAppPath("/candling").screen).toBe("candling");
    expect(parseAppPath("/incubators/chamber-1/candling")).toMatchObject({
      screen: "detail",
      selectedUnit: "chamber-1",
      detailTab: "candling",
    });
    expect(parseAppPath("/trends/chamber-2")).toMatchObject({
      screen: "trends",
      selectedUnit: "chamber-2",
    });
    expect(parseAppPath("/onboarding/3")).toMatchObject({
      screen: "onboarding",
      onboardingStep: 3,
    });
  });

  it("encodes IDs and canonicalizes invalid path parameters", () => {
    const path = incubatorPath("north room/1", "settings");
    expect(path).toBe("/incubators/north%20room%2F1/settings");
    expect(parseAppPath(path).selectedUnit).toBe("north room/1");
    expect(parseAppPath("/incubators/chamber-1/unknown").redirectTo).toBe(
      "/incubators/chamber-1",
    );
    expect(parseAppPath("/onboarding/9").redirectTo).toBe("/onboarding/1");
    expect(parseAppPath("/unknown").screen).toBe("notFound");
    expect(parseAppPath("/unknown").redirectTo).toBeUndefined();
    expect(parseAppPath("/404").screen).toBe("notFound");
  });

  it("redirects unknown incubator IDs without discarding valid trend routes", () => {
    const detail = validateRouteIncubator(parseAppPath("/incubators/missing"), [
      "chamber-1",
    ]);
    const trends = validateRouteIncubator(parseAppPath("/trends/missing"), [
      "chamber-1",
    ]);
    expect(detail.redirectTo).toBe("/incubators");
    expect(trends.redirectTo).toBe("/trends");
  });

  it("maps legacy query-string links to canonical paths", () => {
    expect(legacyPathFromSearch("screen=trends&unit=chamber-2")).toBe(
      "/trends/chamber-2",
    );
    expect(
      legacyPathFromSearch("demo=onboarding&screen=onboarding&step=2"),
    ).toBe("/onboarding/2");
    expect(legacyPathFromSearch("demo=onboarding&screen=login")).toBe("/login");
    expect(legacyPathFromSearch("screen=login")).toBeNull();
  });
});

describe("Wouter integration", () => {
  beforeEach(() => window.history.replaceState(null, "", "/"));

  it("tracks browser Back and Forward navigation", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let currentScreen: ScreenId = "overview";
    let navigateToScreen: ReturnType<typeof useAppRouter>["navigateToScreen"] =
      () => undefined;

    function Probe() {
      const router = useAppRouter(["chamber-1"]);
      currentScreen = router.screen;
      navigateToScreen = router.navigateToScreen;
      return <span>{currentScreen}</span>;
    }

    await act(async () => root.render(<Probe />));
    act(() => navigateToScreen("alerts"));
    act(() => navigateToScreen("settings"));
    expect(currentScreen).toBe("settings");

    act(() => window.history.back());
    await waitFor(() => currentScreen === "alerts");
    act(() => window.history.forward());
    await waitFor(() => currentScreen === "settings");

    await act(async () => root.unmount());
  });

  it("redirects protected content to login for a signed-out mock session", async () => {
    const location = memoryLocation({ path: "/alerts", record: true });
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <Router hook={location.hook}>
          <MockAuthProvider initiallyAuthenticated={false}>
            <RequireAuth>
              <span>protected</span>
            </RequireAuth>
          </MockAuthProvider>
        </Router>,
      ),
    );
    await waitFor(
      () => location.history?.[location.history.length - 1] === "/login",
    );
    expect(location.history).toEqual(["/login"]);

    await act(async () => root.unmount());
  });
});
