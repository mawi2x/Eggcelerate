import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { TrendsScreen } from "../app/components/screens/TrendsScreen";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import type { HatchRecord } from "../app/domain/types";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

describe("Trends tab state ownership", () => {
  it("draws sparse-reading markers, dashed connections and shading with its note below the chart", async () => {
    const modes = createModeFixtures();
    const units = createIncubatorFixtures(modes).slice(0, 1);
    const queryClient = createAppQueryClient();
    const mounted = await render(
      <AppProviders
        repository={new InMemoryEggcelerateRepository()}
        queryClient={queryClient}
      >
        <TrendsScreen units={units} modes={modes} history={[]} />
      </AppProviders>,
    );
    try {
      await waitFor(
        () =>
          mounted.container.querySelectorAll(".recharts-line-dots circle")
            .length > 1,
      );
      expect(
        mounted.container
          .querySelector('.recharts-line-curve[stroke-dasharray="4 4"]')
          ?.getAttribute("d"),
      ).toBeTruthy();
      expect(
        mounted.container
          .querySelector('.recharts-area-area[fill^="url("]')
          ?.getAttribute("d"),
      ).toBeTruthy();
      const chart = mounted.container.querySelector(
        '[aria-labelledby="environmental-chart-title"]',
      );
      const note = mounted.container.querySelector("#environmental-chart-note");
      expect(note?.textContent).toContain("not measured values");
      if (!chart || !note) throw new Error("Missing chart or chart note");
      expect(
        chart.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    } finally {
      await mounted.unmount();
      queryClient.clear();
    }
  });
  it("preserves chart selections, history filters, view and pagination across tab switches", async () => {
    const modes = createModeFixtures();
    const units = createIncubatorFixtures(modes);
    const history: HatchRecord[] = Array.from({ length: 24 }, (_, index) => ({
      id: `history-${index}`,
      chamber: `Retained chamber ${index}`,
      modeName: modes[0].name,
      startDate: "2026-09-01",
      endDate: "2026-09-22",
      totalEggs: 20,
      fertileEggs: 20,
      hatchedEggs: 18,
    }));
    const repository = new InMemoryEggcelerateRepository();
    const listReadings = vi.spyOn(repository, "listReadings");
    const queryClient = createAppQueryClient();
    const mounted = await render(
      <AppProviders repository={repository} queryClient={queryClient}>
        <TrendsScreen units={units} modes={modes} history={history} />
      </AppProviders>,
    );
    const button = (label: string) => {
      const found = [...mounted.container.querySelectorAll("button")].find(
        (node) =>
          node.getAttribute("aria-label") === label ||
          node.textContent?.trim() === label,
      );
      if (!found) throw new Error(`Missing button: ${label}`);
      return found;
    };
    const click = async (label: string) =>
      act(async () => button(label).click());
    try {
      await click("Humidity");
      await click("LAST 7 DAYS");
      await click("Compare Chambers");
      await waitFor(() => queryClient.isFetching() === 0);
      const callsBeforeSwitch = listReadings.mock.calls.length;
      expect(
        listReadings.mock.calls.some(([query]) => query.window === "7d"),
      ).toBe(true);
      const staleReadingsHeading = () =>
        [...mounted.container.querySelectorAll("p")].some(
          (node) => node.textContent?.trim() === "Readings are not latest",
        );
      expect(staleReadingsHeading()).toBe(true);
      await click("Hatch History");
      expect(staleReadingsHeading()).toBe(true);
      const search = mounted.container.querySelector<HTMLInputElement>(
        '[aria-label="Filter hatch history"]',
      );
      if (!search) throw new Error("Missing history search");
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(search, "Retained");
        search.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await click("List view");
      await click("Next page");
      expect(
        mounted.container.querySelector('[aria-current="page"]')?.textContent,
      ).toContain("Page 2 of");
      await click("Environmental Trends");
      expect(button("Humidity").getAttribute("aria-pressed")).toBe("true");
      expect(button("LAST 7 DAYS").getAttribute("aria-pressed")).toBe("true");
      expect(button("Compare Chambers").getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(listReadings.mock.calls.length).toBe(callsBeforeSwitch);
      await click("Hatch History");
      expect(
        mounted.container.querySelector<HTMLInputElement>(
          '[aria-label="Filter hatch history"]',
        )?.value,
      ).toBe("Retained");
      expect(button("List view").getAttribute("aria-pressed")).toBe("true");
      expect(
        mounted.container.querySelector('[aria-current="page"]')?.textContent,
      ).toContain("Page 2 of");
      expect(
        mounted.container.querySelectorAll(
          '[aria-label="Completed hatch cycles"] article',
        ),
      ).toHaveLength(10);
    } finally {
      await mounted.unmount();
      queryClient.clear();
      listReadings.mockRestore();
    }
  });
});
