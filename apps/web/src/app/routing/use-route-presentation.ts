import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseAppPath } from "./routes";

type PositionPolicy = "top" | "preserve" | "restore";
const ENTRY_KEY = "eggcelerateNavigationKey";

// A local history identity, not a security token. Works on LAN HTTP previews too.
function newEntryKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function focusDestination(restoring: boolean) {
  const main = document.querySelector<HTMLElement>("main");
  const target = restoring
    ? main
    : (document.querySelector<HTMLElement>("h1") ?? main);
  if (target) {
    target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
}

/** Scroll belongs to a history entry. Primary navigation starts a fresh visit;
 * Back/Forward restores that entry, while detail tabs retain the current offset.
 */
export function useRoutePresentation(pathname: string) {
  const positions = useRef(new Map<string, number>());
  const currentEntry = useRef<string>("");
  const previousPath = useRef(pathname);
  const listPosition = useRef(0);
  const pending = useRef<{ policy: PositionPolicy; y: number }>({
    policy: "top",
    y: 0,
  });
  const [historyVisit, setHistoryVisit] = useState(0);
  const appliedVisit = useRef(0);

  const savePosition = () => {
    positions.current.set(currentEntry.current, window.scrollY);
    if (previousPath.current === "/incubators") {
      listPosition.current = window.scrollY;
    }
  };

  useEffect(() => {
    const originalRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const state = window.history.state;
    currentEntry.current = state?.[ENTRY_KEY] ?? newEntryKey();
    if (!state?.[ENTRY_KEY]) {
      window.history.replaceState(
        { ...state, [ENTRY_KEY]: currentEntry.current },
        "",
      );
    }
    const recordScroll = () => {
      positions.current.set(currentEntry.current, window.scrollY);
      if (previousPath.current === "/incubators") {
        listPosition.current = window.scrollY;
      }
    };
    const restoreEntry = () => {
      const key = window.history.state?.[ENTRY_KEY];
      pending.current = {
        policy: "restore",
        y: positions.current.get(key) ?? 0,
      };
      currentEntry.current = key ?? "";
      setHistoryVisit((visit) => visit + 1);
    };
    window.addEventListener("scroll", recordScroll, { passive: true });
    window.addEventListener("popstate", restoreEntry);
    return () => {
      window.history.scrollRestoration = originalRestoration;
      window.removeEventListener("scroll", recordScroll);
      window.removeEventListener("popstate", restoreEntry);
    };
  }, []);

  useLayoutEffect(() => {
    const traversedHistory = historyVisit !== appliedVisit.current;
    appliedVisit.current = historyVisit;
    if (previousPath.current === pathname && !traversedHistory) return;
    previousPath.current = pathname;
    currentEntry.current = window.history.state?.[ENTRY_KEY] ?? pathname;
    const { policy, y } = pending.current;
    pending.current = { policy: "top", y: 0 };
    if (policy === "preserve") return;

    // A lazy route can initially be shorter than its saved offset. Wait for its
    // content instead of restoring into a loading placeholder and losing position.
    let finished = false;
    const apply = () => {
      const main = document.querySelector<HTMLElement>("main");
      const heading = document.querySelector("h1");
      if (!heading || main?.querySelector("[data-route-loading]")) return;
      finished = true;
      observer.disconnect();
      focusDestination(policy === "restore");
      window.scrollTo({ top: y, behavior: "instant" });
    };
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    const frame = window.requestAnimationFrame(apply);
    return () => {
      observer.disconnect();
      if (!finished) window.cancelAnimationFrame(frame);
    };
  }, [pathname, historyVisit]);

  return {
    prepareNavigation(target: string, restoreList = false) {
      savePosition();
      const nextKey = newEntryKey();
      const from = parseAppPath(pathname);
      const to = parseAppPath(target);
      const sameDetail =
        from.screen === "detail" &&
        to.screen === "detail" &&
        from.selectedUnit === to.selectedUnit;
      pending.current = {
        policy: restoreList ? "restore" : sameDetail ? "preserve" : "top",
        y: restoreList ? listPosition.current : sameDetail ? window.scrollY : 0,
      };
      if (target === pathname) {
        // Replacing the active destination doesn't cause a pathname render.
        // Track its new identity before any scroll event records the reset.
        currentEntry.current = nextKey;
        if (!sameDetail) {
          focusDestination(restoreList);
          window.scrollTo({ top: pending.current.y, behavior: "instant" });
        }
      }
      return { [ENTRY_KEY]: nextKey };
    },
  };
}
