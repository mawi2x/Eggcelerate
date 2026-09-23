import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { SignInScreen } from "../app/components/auth/SignInScreen";
import { StepperBar } from "../app/components/auth/StepperBar";
import {
  OnboardingStep1Schema,
  OnboardingStep2Schema,
  OnboardingStep3Schema,
  SignInSchema,
} from "../app/data/onboarding";
import { render } from "./render";

describe("onboarding schemas", () => {
  it("rejects invalid sign-in and onboarding values", () => {
    expect(() =>
      SignInSchema.parse({ email: "bad", password: "12345678" }),
    ).toThrow();
    expect(() =>
      OnboardingStep1Schema.parse({ name: "A", farmName: "", location: "OR" }),
    ).toThrow();
    expect(() =>
      OnboardingStep2Schema.parse({ primaryFocus: "commercial", species: [] }),
    ).toThrow();
    expect(() =>
      OnboardingStep3Schema.parse({
        chamberName: "x".repeat(31),
        startingModeId: "broiler",
      }),
    ).toThrow();
  });

  it("accepts a valid sign-in and supplies the selected species", () => {
    expect(
      SignInSchema.parse({
        email: "a@b.co",
        password: "12345678",
        rememberMe: false,
      }),
    ).toBeDefined();
    expect(
      OnboardingStep2Schema.parse({
        primaryFocus: "backyard",
        species: ["chicken"],
      }).species,
    ).toContain("chicken");
  });
});

describe("sign-in and onboarding controls", () => {
  it("validates entered credentials, toggles password visibility and calls setup", async () => {
    const onSignIn = vi.fn();
    const onSetup = vi.fn();
    const mounted = await render(
      <SignInScreen onSignIn={onSignIn} onSetup={onSetup} />,
    );
    try {
      expect(mounted.container.querySelector("h1")?.textContent).toBe(
        "Check on your clutch.",
      );
      const email =
        mounted.container.querySelector<HTMLInputElement>("#signin-email");
      const password =
        mounted.container.querySelector<HTMLInputElement>("#signin-pw");
      if (!email || !password) throw new Error("Missing sign-in fields");
      expect(
        mounted.container.querySelector('label[for="signin-email"]'),
      ).not.toBeNull();
      expect(
        mounted.container.querySelector('label[for="signin-pw"]'),
      ).not.toBeNull();

      const setValue = (input: HTMLInputElement, value: string) => {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set;
        if (!setter) throw new Error("Missing input value setter");
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };

      await act(async () => {
        setValue(email, "invalid");
        setValue(password, "12345678");
      });
      const submit = [...mounted.container.querySelectorAll("button")].find(
        (button) => button.textContent?.includes("Sign in"),
      );
      if (!submit) throw new Error("Missing sign-in action");
      await act(async () => submit.click());
      expect(onSignIn).not.toHaveBeenCalled();
      expect(mounted.container.textContent).toContain("valid email");

      await act(async () => setValue(email, "farmer@example.com"));
      await act(async () => submit.click());
      expect(onSignIn).toHaveBeenCalledWith("farmer@example.com");

      const showPassword = mounted.container.querySelector<HTMLButtonElement>(
        'button[aria-label="Show password"]',
      );
      await act(async () => showPassword?.click());
      expect(password.type).toBe("text");
      await act(async () =>
        mounted.container
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Hide password"]',
          )
          ?.click(),
      );
      expect(password.type).toBe("password");

      const setup = [...mounted.container.querySelectorAll("button")].find(
        (button) => button.textContent?.includes("Set up your farm"),
      );
      await act(async () => setup?.click());
      expect(onSetup).toHaveBeenCalledOnce();
    } finally {
      await mounted.unmount();
    }
  });

  it("announces onboarding progress and returns to sign-in", async () => {
    const onHaveAccount = vi.fn();
    const mounted = await render(
      <StepperBar step={2} onHaveAccount={onHaveAccount} />,
    );
    try {
      const progress = mounted.container.querySelector('[role="progressbar"]');
      expect(progress?.getAttribute("aria-valuenow")).toBe("2");
      expect(progress?.getAttribute("aria-label")).toBe("Step 2 of 3");
      const back = [...mounted.container.querySelectorAll("button")].find(
        (button) => button.textContent?.includes("I have an account"),
      );
      await act(async () => back?.click());
      expect(onHaveAccount).toHaveBeenCalledOnce();
    } finally {
      await mounted.unmount();
    }
  });
});
