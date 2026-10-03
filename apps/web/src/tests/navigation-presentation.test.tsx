import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppRouter } from "../app/routing/use-app-router";
import { render, waitFor } from "./render";

describe("destination scroll and focus", () => {
  let y = 0;
  let router: ReturnType<typeof useAppRouter>;
  let mounted: Awaited<ReturnType<typeof render>>;
  const originalScrollY = Object.getOwnPropertyDescriptor(window, "scrollY");
  const originalRestoration = window.history.scrollRestoration;

  function Probe({ loading = false }: { loading?: boolean }) {
    router = useAppRouter();
    return (
      <main tabIndex={-1}>
        <h1>{router.screen}</h1>
        {loading && <div data-route-loading>Loading</div>}
        <button type="button">Route control</button>
      </main>
    );
  }

  beforeEach(() => {
    y = 0;
    window.history.replaceState(null, "", "/");
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      get: () => y,
    });
    vi.spyOn(window, "scrollTo").mockImplementation(
      (options: ScrollToOptions | number, top?: number) => {
        y = typeof options === "object" ? (options.top ?? 0) : (top ?? 0);
      },
    );
  });

  afterEach(async () => {
    await mounted?.unmount();
    vi.restoreAllMocks();
    if (originalScrollY)
      Object.defineProperty(window, "scrollY", originalScrollY);
    window.history.scrollRestoration = originalRestoration;
  });

  const scroll = (next: number) => {
    y = next;
    window.dispatchEvent(new Event("scroll"));
  };

  it("resets primary destinations and focuses the new heading, even on reselection", async () => {
    mounted = await render(<Probe />);
    scroll(471);
    await act(async () => router.navigateToScreen("incubators"));
    await waitFor(() => y === 0);
    expect(document.activeElement?.textContent).toBe("incubators");
    scroll(250);
    const historyLength = window.history.length;
    await act(async () => router.navigateToScreen("incubators"));
    expect(y).toBe(0);
    expect(window.history.length).toBe(historyLength);
    scroll(275);
    await act(async () => router.navigateToScreen("alerts"));
    await waitFor(() => y === 0);
    await act(async () => window.history.back());
    await waitFor(() => router.screen === "incubators" && y === 275);
    expect(window.history.scrollRestoration).toBe("manual");
  });

  it("restores separate history visits to the same destination on Back and Forward", async () => {
    mounted = await render(<Probe />);
    scroll(120);
    await act(async () => router.navigateToScreen("alerts"));
    await waitFor(() => y === 0);
    scroll(310);
    await act(async () => router.navigateToScreen("overview"));
    await waitFor(() => y === 0);
    scroll(75);
    await act(async () => window.history.back());
    await waitFor(() => router.screen === "alerts" && y === 310);
    expect(document.activeElement?.tagName).toBe("MAIN");
    await act(async () => window.history.back());
    await waitFor(() => router.screen === "overview" && y === 120);
    await act(async () => window.history.forward());
    await waitFor(() => router.screen === "alerts" && y === 310);
  });

  it("keeps detail tabs in place and restores the list only on the explicit return", async () => {
    mounted = await render(<Probe />);
    await act(async () => router.navigateToScreen("incubators"));
    await waitFor(() => y === 0);
    scroll(640);
    await act(async () => router.openIncubator("chamber-1"));
    await waitFor(() => router.screen === "detail" && y === 0);
    scroll(180);
    const control =
      mounted.container.querySelector<HTMLButtonElement>("button");
    control?.focus();
    await act(async () => router.openIncubator("chamber-1", "settings", true));
    expect(y).toBe(180);
    expect(document.activeElement).toBe(control);
    await act(async () => router.returnToIncubators());
    await waitFor(() => router.screen === "incubators" && y === 640);
    expect(document.activeElement?.tagName).toBe("MAIN");
    await act(async () => router.openIncubator("chamber-2"));
    await waitFor(() => y === 0);
    scroll(200);
    await act(async () => router.navigateToScreen("incubators"));
    await waitFor(() => y === 0);
  });

  it("waits for lazy content before restoring a history position", async () => {
    mounted = await render(<Probe />);
    scroll(390);
    await act(async () => router.navigateToScreen("trends"));
    await waitFor(() => y === 0);
    await mounted.rerender(<Probe loading />);
    await act(async () => window.history.back());
    await waitFor(() => router.screen === "overview");
    expect(y).toBe(0);
    await mounted.rerender(<Probe />);
    await waitFor(() => y === 390);
  });

  it("handles auth/onboarding routes and restores the original browser setting on unmount", async () => {
    mounted = await render(<Probe />);
    for (const navigate of [
      () => router.openLogin(),
      () => router.openRegister(),
      () => router.openOnboarding(2),
      () => router.openTrends("chamber-1"),
    ]) {
      scroll(100);
      await act(async () => navigate());
      await waitFor(() => y === 0);
    }
    await mounted.unmount();
    expect(window.history.scrollRestoration).toBe(originalRestoration);
    // Keep afterEach cleanup idempotent.
    mounted = undefined as unknown as typeof mounted;
  });
});
