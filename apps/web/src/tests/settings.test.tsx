import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "../app/components/screens/SettingsScreen";
import { validateNotificationPreferences } from "../app/components/settings/NotificationsPanel";
import { InMemoryEggcelerateRepository } from "../app/data/repositories/in-memory-repository";
import { initialSettings } from "../app/data/settings";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

const actEnvironment = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

describe("settings contracts", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });
  afterEach(() => vi.unstubAllGlobals());
  it("saves and reloads an isolated repository settings snapshot", async () => {
    const repository = new InMemoryEggcelerateRepository();
    const next = structuredClone(initialSettings);
    next.account.farmName = "North Field Farm";
    const saved = await repository.saveSettings(next);
    next.account.farmName = "Mutated outside";
    const loaded = await repository.listSettings();

    expect(saved.ok && saved.data.account.farmName).toBe("North Field Farm");
    expect(loaded.ok && loaded.data.account.farmName).toBe("North Field Farm");
  });

  it("does not replace confirmed settings when save times out", async () => {
    const repository = new InMemoryEggcelerateRepository({
      failureModes: { saveSettings: "timeout" },
    });
    const next = structuredClone(initialSettings);
    next.account.farmName = "Unconfirmed Farm";
    const saved = await repository.saveSettings(next);
    const loaded = await repository.listSettings();

    expect(saved.ok).toBe(false);
    expect(loaded.ok && loaded.data.account.farmName).toBe(
      initialSettings.account.farmName,
    );
  });

  it("validates notification contacts before saving", () => {
    expect(
      validateNotificationPreferences({
        ...initialSettings.notifications,
        phone: "0917",
      }),
    ).toContain("international phone format");
    expect(
      validateNotificationPreferences({
        ...initialSettings.notifications,
        emailAddress: "farmer@example.com",
      }),
    ).toBeNull();
  });

  it("marks edited settings dirty and Discard restores the confirmed value", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const saveSettings = vi.fn(async () => false);

    await act(async () =>
      root.render(
        <SettingsScreen
          modes={[]}
          onUpdateMode={async () => true}
          onAddMode={async () => true}
          onDeleteMode={async () => true}
          settings={structuredClone(initialSettings)}
          onSaveSettings={saveSettings}
          isSaving={false}
          units={[]}
        />,
      ),
    );
    const accountTab = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("FARM & ACCOUNT"),
    );
    await act(async () => accountTab?.click());
    const farmInput = container.querySelector<HTMLInputElement>("#farm");
    if (!farmInput) throw new Error("Missing #farm input");
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    const valueSetter = valueDescriptor?.set;
    if (typeof valueSetter !== "function") {
      throw new Error("Missing HTMLInputElement value setter");
    }
    await act(async () => {
      valueSetter.call(farmInput, "Changed Farm");
      farmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const saveButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Save Changes"),
    );
    const discardButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("Discard"),
    );
    if (!saveButton) throw new Error("Missing Save Changes button");
    if (!discardButton) throw new Error("Missing Discard button");

    expect(saveButton.disabled).toBe(false);
    expect(container.textContent).toContain("unsaved settings changes");
    await act(async () => saveButton.click());
    expect(saveSettings).toHaveBeenCalledTimes(1);
    expect(container.querySelector<HTMLInputElement>("#farm")?.value).toBe(
      "Changed Farm",
    );
    expect(container.textContent).toContain("unsaved settings changes");
    await act(async () => discardButton.click());
    expect(container.querySelector<HTMLInputElement>("#farm")?.value).toBe(
      initialSettings.account.farmName,
    );
    expect(saveButton.disabled).toBe(true);

    await act(async () => root.unmount());
  });
  it("keeps settings category labels concise on mobile navigation", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () =>
      root.render(
        <SettingsScreen
          modes={[]}
          onUpdateMode={async () => true}
          onAddMode={async () => true}
          onDeleteMode={async () => true}
          settings={structuredClone(initialSettings)}
          onSaveSettings={async () => true}
          isSaving={false}
          units={[]}
        />,
      ),
    );

    const navigation = container.querySelector(
      'nav[aria-label="Settings categories"]',
    );
    if (!navigation) throw new Error("Missing settings category navigation");
    expect(navigation.textContent).toContain("Modes");
    expect(navigation.textContent).toContain("Alerts");
    expect(navigation.textContent).toContain("Account");
    expect(navigation.textContent).toContain("Hardware");

    await act(async () => root.unmount());
  });
});
