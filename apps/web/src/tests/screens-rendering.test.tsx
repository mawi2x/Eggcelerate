import { act } from "react";
import { describe, expect, it } from "vitest";
import { Router } from "wouter";
import { memoryLocation } from "wouter/memory-location";
import App from "../app/App";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

describe("application screens render their accessible page structure", () => {
  it("routes through every dashboard and mock-onboarding screen", async () => {
    await act(async () => {
      await Promise.all([
        import("../app/components/auth/OnboardingStep2"),
        import("../app/components/auth/OnboardingStep3"),
        import("../app/components/screens/CandlingLogsScreen"),
        import("../app/components/screens/DetailScreen"),
        import("../app/components/screens/TrendsScreen"),
      ]);
    });
    const location = memoryLocation({ path: "/", record: true });
    const mounted = await render(
      <Router hook={location.hook}>
        <AppProviders
          repository={new InMemoryEggcelerateRepository()}
          queryClient={createAppQueryClient()}
        >
          <App />
        </AppProviders>
      </Router>,
    );

    const routes = [
      ["/", "Good day"],
      ["/incubators", "Incubators"],
      ["/candling", "Candling Logs"],
      ["/incubators/chamber-1", "Chamber One"],
      ["/trends", "Historical Trends"],
      ["/alerts", "Notification Center"],
      ["/settings", "Settings"],
      ["/login", "Check on your clutch."],
      ["/onboarding/1", "Let’s set up your farm."],
      ["/onboarding/2", "What are you hatching?"],
      ["/onboarding/3", "Name your first chamber."],
    ] as const;
    const loadedScreenSelectors: Record<string, string> = {
      "/candling": 'section[aria-label="Candling journal list"]',
      "/incubators/chamber-1": '[aria-label="Incubator detail sections"]',
      "/trends": "#environmental-chart-title",
    };

    try {
      for (const [route, expectedHeading] of routes) {
        await act(async () => location.navigate(route));
        await waitFor(
          () =>
            [...mounted.container.querySelectorAll("h1")].some((heading) =>
              heading.textContent?.includes(expectedHeading),
            ),
          `The ${route} screen did not render its ${expectedHeading} heading.`,
          10_000,
        );
        const loadedScreenSelector = loadedScreenSelectors[route];
        if (loadedScreenSelector) {
          await waitFor(
            () =>
              Boolean(mounted.container.querySelector(loadedScreenSelector)),
            `The ${route} screen content did not finish rendering.`,
            10_000,
          );
        }

        for (const section of mounted.container.querySelectorAll<HTMLElement>(
          "section[aria-labelledby]",
        )) {
          const headingId = section.getAttribute("aria-labelledby");
          expect(headingId).toBeTruthy();
          expect(document.getElementById(headingId as string)).not.toBeNull();
        }

        if (route === "/trends") {
          const chartTitle = mounted.container.querySelector<HTMLElement>(
            "#environmental-chart-title",
          );
          expect(chartTitle).not.toBeNull();
          expect(
            window.getComputedStyle(chartTitle as HTMLElement).fontSize,
          ).toBe("var(--type-heading-md)");
        }
      }
    } finally {
      await mounted.unmount();
    }
  }, 30_000);

  it("moves focus and the active marker to the selected mobile chamber", async () => {
    const previousWidth = window.innerWidth;
    const previousScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const previousRequestAnimationFrame = window.requestAnimationFrame;
    const previousCancelAnimationFrame = window.cancelAnimationFrame;
    const animationFrames = new Map<number, FrameRequestCallback>();
    let nextFrameId = 0;
    window.requestAnimationFrame = (callback) => {
      const id = ++nextFrameId;
      animationFrames.set(id, callback);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      animationFrames.delete(id);
    };
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 390,
    });
    const location = memoryLocation({ path: "/incubators", record: true });
    const mounted = await render(
      <Router hook={location.hook}>
        <AppProviders
          repository={new InMemoryEggcelerateRepository()}
          queryClient={createAppQueryClient()}
        >
          <App />
        </AppProviders>
      </Router>,
    );

    try {
      await waitFor(
        () =>
          mounted.container.querySelectorAll('button[aria-label^="Scroll to "]')
            .length > 1,
        `Mobile chamber index did not render. Headings: ${[
          ...mounted.container.querySelectorAll("h1"),
        ].map((heading) => heading.textContent)}; buttons: ${[
          ...mounted.container.querySelectorAll("button"),
        ].map((button) => button.getAttribute("aria-label"))}`,
      );
      const cards = [
        ...mounted.container.querySelectorAll<HTMLElement>(
          "[data-chamber-idx]",
        ),
      ];
      const targetY = window.innerHeight * 0.35;
      const cardTops = new Map<HTMLElement, number>();
      cards.forEach((card, index) => {
        cardTops.set(card, index === 0 ? targetY : 1_000 + index);
        card.getBoundingClientRect = () =>
          ({ top: cardTops.get(card) ?? 1_000 }) as DOMRect;
      });
      HTMLElement.prototype.scrollIntoView = function () {
        const selected = this.closest<HTMLElement>("[data-chamber-idx]");
        if (!selected) return;
        for (const card of cards) {
          cardTops.set(card, card === selected ? targetY : 1_000);
        }
        window.dispatchEvent(new Event("scroll"));
      };

      const dot = mounted.container.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Scroll to "]',
      )[1];
      const grid =
        mounted.container.querySelector<HTMLElement>(".grid.grid-cols-1");
      expect(grid).not.toBeNull();
      expect(grid?.className).toContain("lg:grid-cols-2");
      expect(grid?.className).toContain("xl:grid-cols-3");

      await act(async () => {
        dot?.click();
        for (const [id, callback] of animationFrames) {
          animationFrames.delete(id);
          callback(performance.now());
        }
      });
      expect(dot?.getAttribute("aria-current")).toBe("true");
      expect(
        document.activeElement?.closest('[data-chamber-idx="1"]'),
      ).not.toBeNull();
    } finally {
      await mounted.unmount();
      HTMLElement.prototype.scrollIntoView = previousScrollIntoView;
      window.requestAnimationFrame = previousRequestAnimationFrame;
      window.cancelAnimationFrame = previousCancelAnimationFrame;
      Object.defineProperty(window, "innerWidth", {
        configurable: true,
        value: previousWidth,
      });
    }
  });
});
