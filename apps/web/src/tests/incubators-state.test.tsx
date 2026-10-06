import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IncubatorsScreen } from "../app/components/screens/IncubatorsScreen";
import { createIncubatorFixtures } from "../app/data/fixtures/incubators";
import { createModeFixtures } from "../app/data/fixtures/modes";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { getKnownFertileEggs } from "../app/domain/fertility";
import type { Incubator } from "../app/domain/types";
import {
  AppProviders,
  createAppQueryClient,
} from "../app/providers/AppProviders";
import { render, waitFor } from "./render";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => vi.restoreAllMocks());

const modes = createModeFixtures();
const fixtures = createIncubatorFixtures(modes);
function button(container: ParentNode, label: string) {
  const found = [
    ...container.querySelectorAll<HTMLButtonElement>("button"),
  ].find(
    (item) =>
      item.getAttribute("aria-label") === label ||
      item.textContent?.trim().startsWith(label),
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function fill(selector: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing input: ${selector}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function mountScreen(units: Incubator[], add = vi.fn(async () => true)) {
  const repository = new InMemoryEggcelerateRepository();
  const client = createAppQueryClient();
  const open = vi.fn();
  const screen = (
    <AppProviders repository={repository} queryClient={client}>
      <IncubatorsScreen
        units={units}
        modes={modes}
        onOpenUnit={open}
        onAddIncubator={add}
        isAddingIncubator={false}
      />
    </AppProviders>
  );
  const mounted = await render(screen);
  return { ...mounted, repository, client, open };
}

describe("Incubators screen state ownership", () => {
  it("keeps list selections and pagination when toggling views or opening creation", async () => {
    const units = Array.from({ length: 24 }, (_, index) => ({
      ...fixtures[0],
      id: `unit-${index}`,
      name: `Chamber ${index + 1}`,
      status: index < 12 ? ("optimal" as const) : ("alert" as const),
    }));
    const mounted = await mountScreen(units);
    try {
      await act(async () => button(mounted.container, "List view").click());
      await fill('[aria-label="Search incubators"]', "Chamber");
      await act(async () => button(mounted.container, "Normal").click());
      await act(async () =>
        button(mounted.container, "Sort direction: ascending").click(),
      );
      await act(async () => button(mounted.container, "Next page").click());
      expect(mounted.container.querySelectorAll("tbody tr")).toHaveLength(2);
      await act(async () => button(mounted.container, "Grid view").click());
      await act(async () => button(mounted.container, "List view").click());
      await act(async () => button(mounted.container, "Add incubator").click());
      await waitFor(() => Boolean(document.querySelector("#deviceId")));
      await act(async () => button(document, "Cancel").click());
      await waitFor(() => document.querySelector("#deviceId") === null);
      expect(
        mounted.container.querySelector<HTMLInputElement>(
          '[aria-label="Search incubators"]',
        )?.value,
      ).toBe("Chamber");
      expect(
        button(mounted.container, "Normal").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        button(mounted.container, "List view").getAttribute("aria-pressed"),
      ).toBe("true");
      expect(
        button(mounted.container, "Sort direction: descending"),
      ).toBeDefined();
      expect(
        mounted.container.querySelector('[aria-current="page"]')?.textContent,
      ).toContain("Page 2 of 2");
      const row = mounted.container.querySelector("tbody tr");
      const name = row?.querySelector("td")?.textContent;
      await act(async () =>
        button(row as ParentNode, `Configure ${name}`).click(),
      );
      expect(mounted.open).toHaveBeenCalledWith(
        units.find((unit) => unit.name === name)?.id,
      );
      await fill('[aria-label="Search incubators"]', "no matching chamber");
      expect(mounted.container.textContent).toContain(
        "No chambers match your filters",
      );
      await act(async () => button(mounted.container, "Clear filters").click());
      expect(mounted.container.querySelectorAll("tbody tr")).toHaveLength(10);
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("locks the creation dialog during a write and preserves its draft after failure", async () => {
    let confirm: (saved: boolean) => void = () => {};
    const add = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          confirm = resolve;
        }),
    );
    const mounted = await mountScreen([fixtures[0]], add);
    try {
      await act(async () => button(mounted.container, "Add incubator").click());
      await waitFor(() => Boolean(document.querySelector("#deviceId")));
      await fill("#deviceId", "egg-9999");
      await fill("#name", "Pending chamber");
      await act(async () => button(document, "Connect Incubator").click());
      expect(add).toHaveBeenCalledTimes(1);
      expect(
        document.querySelector<HTMLInputElement>("#deviceId")?.disabled,
      ).toBe(true);
      expect(document.querySelector<HTMLInputElement>("#name")?.disabled).toBe(
        true,
      );
      expect(button(document, "Cancel").disabled).toBe(true);
      expect(
        button(document, "Connecting to Incubator").getAttribute("aria-busy"),
      ).toBe("true");
      await act(async () =>
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
          }),
        ),
      );
      expect(document.querySelector("#deviceId")).not.toBeNull();
      await act(async () => confirm(false));
      expect(
        document.querySelector<HTMLInputElement>("#deviceId")?.disabled,
      ).toBe(false);
      expect(document.querySelector<HTMLInputElement>("#name")?.value).toBe(
        "Pending chamber",
      );
      await act(async () => button(document, "Cancel").click());
      await waitFor(() => document.querySelector("#deviceId") === null);
      await act(async () => button(mounted.container, "Add incubator").click());
      await waitFor(() => Boolean(document.querySelector("#deviceId")));
      expect(document.querySelector<HTMLInputElement>("#name")?.value).toBe(
        "Pending chamber",
      );
      expect(document.querySelector<HTMLInputElement>("#deviceId")?.value).toBe(
        "egg-9999",
      );
    } finally {
      confirm(false);
      await mounted.unmount();
      mounted.client.clear();
    }
  });

  it("finishes a harvest through the repository and closes only after it is saved", async () => {
    const unit = fixtures.find(
      (candidate) =>
        candidate.dayOfIncubation >=
        (modes.find((mode) => mode.id === candidate.modeId)?.incubationDays ??
          Infinity),
    );
    if (!unit) throw new Error("Missing completed-cycle fixture");
    const mounted = await mountScreen([unit]);
    const complete = vi.spyOn(mounted.repository, "completeCycle");
    try {
      await act(async () =>
        button(mounted.container, `Finish cycle for ${unit.name}`).click(),
      );
      await waitFor(() => Boolean(document.querySelector("#harvest-hatched")));
      const hatched = Math.min(
        getKnownFertileEggs(unit) ?? 1,
        unit.totalEggsLoaded ?? 1,
      );
      await fill("#harvest-hatched", String(hatched));
      await act(async () => button(document, "Save & Reset").click());
      await waitFor(() => document.querySelector("#harvest-hatched") === null);
      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          incubatorId: unit.id,
          hatchedEggs: hatched,
          fertileEggs: getKnownFertileEggs(unit),
        }),
        expect.objectContaining({ idempotencyKey: expect.any(String) }),
      );
      const history = await mounted.repository.listHatchRecords();
      expect(
        history.ok &&
          history.data.some(
            (record) =>
              record.chamber === unit.name && record.hatchedEggs === hatched,
          ),
      ).toBe(true);
      const units = await mounted.repository.listIncubators();
      expect(
        units.ok &&
          units.data.find((candidate) => candidate.id === unit.id)?.cyclePhase,
      ).toBe("ready");
    } finally {
      await mounted.unmount();
      mounted.client.clear();
    }
  });
});
