import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { Timeline } from "../app/components/detail/Timeline";

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const candling = [
  { day: 8, label: "First candling" },
  { day: 17, label: "Second candling" },
  { day: 24, label: "Lockdown" },
];

async function renderTimeline(
  labelSize?: 10 | 9,
  onSelectMilestone: (day: number) => void = () => {},
) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Timeline
        currentDay={9}
        totalDays={28}
        candling={candling}
        candled={{}}
        onSelectMilestone={onSelectMilestone}
        {...(labelSize === undefined ? {} : { labelSize })}
      />,
    ),
  );
  return { container, root };
}

describe("timeline milestone density", () => {
  it("defaults to the 10px compact exception on mobile labels", async () => {
    const { container, root } = await renderTimeline();
    const labels = Array.from(
      container.querySelectorAll('[data-timeline="compact-label"]'),
    );
    const days = Array.from(
      container.querySelectorAll('[data-timeline="compact-day"]'),
    );
    expect(labels).toHaveLength(3);
    expect(days).toHaveLength(3);
    for (const el of [...labels, ...days]) {
      expect((el as HTMLElement).style.fontSize).toBe(
        "var(--type-label-compact)",
      );
    }
    await act(async () => root.unmount());
  });

  it("renders the 9px micro exception when labelSize={9}", async () => {
    const { container, root } = await renderTimeline(9);
    const labels = Array.from(
      container.querySelectorAll('[data-timeline="compact-label"]'),
    );
    expect(labels).toHaveLength(3);
    for (const el of labels) {
      expect((el as HTMLElement).style.fontSize).toBe(
        "var(--type-label-micro)",
      );
    }
    await act(async () => root.unmount());
  });

  it("sends milestone selections to the journal navigator", async () => {
    let selectedDay: number | null = null;
    const { container, root } = await renderTimeline(undefined, (day) => {
      selectedDay = day;
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="First candling, Day 8"]',
        )
        ?.click();
    });
    expect(selectedDay).toBe(8);
    await act(async () => root.unmount());
  });
});
