import { describe, expect, it } from "vitest";
import { HatchSummaryPanel } from "../app/components/trends/HatchSummaryPanel";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import {
  selectHatchSpeciesSummaries,
  selectHatchSummary,
} from "../app/features/trends/selectors";
import { render } from "./render";

describe("Hatch summary panel", () => {
  it("distinguishes eggs set from fertile eggs and exposes partial rate coverage", async () => {
    const fixture = createHatchRecordFixtures()[0];
    const history = [
      {
        ...fixture,
        modeName: "Broiler",
        totalEggs: 12,
        fertileEggs: 10,
        hatchedEggs: 8,
      },
      {
        ...fixture,
        id: "unknown",
        modeName: "Duck",
        totalEggs: 20,
        fertileEggs: null,
        hatchedEggs: 15,
      },
    ];
    const mounted = await render(
      <HatchSummaryPanel
        summary={selectHatchSummary(history)}
        speciesSummaries={selectHatchSpeciesSummaries(history)}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain(
        "23 chicks hatched from 32 eggs set",
      );
      expect(mounted.container.textContent).toContain(
        "8 chicks from 10 fertile eggs",
      );
      expect(mounted.container.textContent).toContain("1 of 2 cycles");
      // CSS switches between the mobile carousel and desktop list. Verify
      // each layout independently; jsdom does not hide elements using CSS.
      const lists = mounted.container.querySelectorAll(
        'ul[aria-label="Hatchability by species"]',
      );
      expect(lists).toHaveLength(2);
      for (const list of lists) {
        const bars = list.querySelectorAll('[role="progressbar"]');
        expect(bars).toHaveLength(1);
        expect(bars[0].getAttribute("aria-label")).toBe("Broiler hatchability");
        expect(bars[0].getAttribute("aria-valuenow")).toBe("80");
        expect(list.textContent).toContain("Duck");
        expect(list.textContent).toContain("Fertile egg count unavailable");
      }
      expect(mounted.container.textContent).toContain(
        "Fertile egg count unavailable",
      );
    } finally {
      await mounted.unmount();
    }
  });

  it("shows a clear empty summary without implying zero hatchability", async () => {
    const mounted = await render(
      <HatchSummaryPanel
        summary={selectHatchSummary([])}
        speciesSummaries={[]}
      />,
    );
    try {
      expect(mounted.container.textContent).toContain("N/A");
      expect(mounted.container.textContent).toContain(
        "Complete your first cycle",
      );
      expect(
        mounted.container.querySelector('[role="progressbar"]'),
      ).toBeNull();
    } finally {
      await mounted.unmount();
    }
  });
});
