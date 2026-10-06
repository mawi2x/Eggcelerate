import { describe, expect, it } from "vitest";
import { HatchRecordCard } from "../app/components/trends/HatchRecordCard";
import { createHatchRecordFixtures } from "../app/data/fixtures/hatch-records";
import { selectHatchWithPct } from "../app/features/trends/selectors";
import { render } from "./render";

describe("Hatch history record", () => {
  it("keeps the hatchability bar separate from eggs-set counts", async () => {
    const record = selectHatchWithPct(createHatchRecordFixtures())[0];
    const mounted = await render(<HatchRecordCard record={record} compact />);
    try {
      expect(mounted.container.textContent).toContain(
        "Jun 1, 2026 to Jun 22, 2026",
      );
      expect(mounted.container.textContent).toContain(
        "16 hatched and 2 unhatched from 18 eggs set",
      );
      expect(mounted.container.textContent).toContain(
        "Based on 17 fertile eggs",
      );
      const bar = mounted.container.querySelector('[role="progressbar"]');
      expect(bar?.getAttribute("aria-valuenow")).toBe("94.1");
      expect(bar?.getAttribute("aria-valuetext")).toContain(
        "16 chicks from 17 fertile eggs",
      );
    } finally {
      await mounted.unmount();
    }
  });

  it("shows missing fertility data without displaying a zero-rate bar", async () => {
    const record = selectHatchWithPct([
      { ...createHatchRecordFixtures()[0], fertileEggs: null },
    ])[0];
    const mounted = await render(<HatchRecordCard record={record} />);
    try {
      expect(mounted.container.textContent).toContain("N/A");
      expect(mounted.container.textContent).toContain(
        "16 hatched and 2 unhatched",
      );
      expect(mounted.container.textContent).toContain(
        "Hatchability unavailable",
      );
      expect(
        mounted.container.querySelector('[role="progressbar"]'),
      ).toBeNull();
    } finally {
      await mounted.unmount();
    }
  });
});
