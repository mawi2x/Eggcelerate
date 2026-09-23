import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { FilterBar } from "../app/components/ui/filter-bar";
import { render } from "./render";

describe("FilterBar rendered behavior", () => {
  it("exposes selected filters, token styles, focus and selection changes", async () => {
    const onChange = vi.fn();
    const mounted = await render(
      <FilterBar
        ariaLabel="Chamber status"
        value="all"
        onChange={onChange}
        options={[
          { key: "all", label: "All", count: 12 },
          {
            key: "healthy",
            label: "Healthy",
            mobileLabel: "Good",
            compactMobileLabel: "OK",
            count: 8,
            icon: <span>Temperature</span>,
          },
        ]}
      />,
    );
    try {
      const group = mounted.container.querySelector<HTMLFieldSetElement>(
        'fieldset[aria-label="Chamber status"]',
      );
      const selected = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="All (12)"]',
      );
      const healthy = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Healthy (8)"]',
      );

      expect(group).not.toBeNull();
      expect(selected?.getAttribute("aria-pressed")).toBe("true");
      expect(healthy?.getAttribute("aria-pressed")).toBe("false");
      expect(healthy?.textContent).toContain("Temperature");
      expect(healthy?.className).toContain(
        "min-h-[var(--control-height-chip-touch)]",
      );
      expect(
        window.getComputedStyle(healthy as HTMLButtonElement).fontSize,
      ).toBe("var(--type-label)");

      healthy?.focus();
      expect(document.activeElement).toBe(healthy);
      await act(async () => healthy?.click());
      expect(onChange).toHaveBeenCalledWith("healthy");
    } finally {
      await mounted.unmount();
    }
  });

  it("shows scroll controls only when the filter track overflows", async () => {
    const mounted = await render(
      <FilterBar
        value="all"
        onChange={() => {}}
        options={[{ key: "all", label: "All" }]}
      />,
    );
    try {
      const track =
        mounted.container.querySelector<HTMLFieldSetElement>("fieldset");
      if (!track) throw new Error("Missing filter track");
      Object.defineProperties(track, {
        clientWidth: { configurable: true, value: 120 },
        scrollWidth: { configurable: true, value: 320 },
        scrollLeft: { configurable: true, value: 80, writable: true },
      });
      const scrollBy = vi.fn();
      track.scrollBy = scrollBy;
      await act(async () => track.dispatchEvent(new Event("scroll")));

      const previous = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Show previous filters"]',
      );
      const next = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Show more filters"]',
      );
      expect(previous?.tabIndex).toBe(0);
      expect(next?.tabIndex).toBe(0);
      await act(async () => next?.click());
      expect(scrollBy).toHaveBeenCalledWith({ left: 140, behavior: "smooth" });
    } finally {
      await mounted.unmount();
    }
  });

  it("uses an equal-width segmented row without paging arrows", async () => {
    const mounted = await render(
      <FilterBar
        ariaLabel="Settings categories"
        value="account"
        onChange={() => {}}
        variant="segmented"
        fitToScreenOnMobile
        options={[
          { key: "modes", label: "MODE LIBRARY", mobileLabel: "Modes" },
          { key: "account", label: "FARM & ACCOUNT", mobileLabel: "Account" },
        ]}
      />,
    );
    try {
      const account = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="FARM & ACCOUNT"]',
      );
      expect(account?.getAttribute("aria-pressed")).toBe("true");
      expect(account?.className).toContain("min-w-0 flex-1");
      expect(
        mounted.container.querySelector<HTMLButtonElement>(
          'button[aria-label="Show more filters"]',
        )?.tabIndex,
      ).toBe(-1);
    } finally {
      await mounted.unmount();
    }
  });
});
