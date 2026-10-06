import { act } from "react";
import { describe, expect, it } from "vitest";
import { IncubationCalendar } from "../app/components/detail/IncubationCalendar";
import { render } from "./render";

const candling = [
  { day: 6, label: "First candling", dayRange: "Day 5 to 7" },
  { day: 13, label: "Second candling", dayRange: "Day 12 to 14" },
  { day: 18, label: "Lockdown check", dayRange: "Day 18" },
];

describe("incubation calendar summary", () => {
  it("shows cycle status and all milestones without the redundant day strip", async () => {
    const mounted = await render(
      <IncubationCalendar currentDay={22} totalDays={21} candling={candling} />,
    );

    try {
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>('button[aria-label="Show summary"]')
          ?.click(),
      );

      expect(mounted.container.textContent).toContain(
        "Day 22 — 1 day past expected hatch",
      );
      expect(mounted.container.textContent).toContain("2nd Candling");
      expect(
        mounted.container.querySelector(
          '[aria-label="This week in the cycle"]',
        ),
      ).toBeNull();

      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Show cycle calendar"]',
          )
          ?.click(),
      );
      expect(
        mounted.container.querySelector(
          'button[aria-label*="cycle Day 13, Second candling"]',
        ),
      ).not.toBeNull();
    } finally {
      await mounted.unmount();
    }
  });
});
