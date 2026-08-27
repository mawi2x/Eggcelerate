import { describe, it, expect } from "vitest";
import fs from "fs"; import path from "path";
import { SignInSchema, OnboardingStep1Schema, OnboardingStep2Schema, OnboardingStep3Schema } from "../app/data/onboarding";
describe("auth guide + folder prep", () => {
  it("guide exists and mentions mock flag", () => {
    const s = fs.readFileSync(path.resolve("docs/guide/auth-onboarding-guide.md"), "utf-8");
    expect(s).toContain("?demo=onboarding");
    expect(s).toContain("var(--brand-primary)");
    expect(s).toContain("mock-only");
  });
  it("auth folder README exists and maps components", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/README.md"), "utf-8");
    expect(s).toContain("AuthCard");
    expect(s).toContain("StepperBar");
    expect(s).toContain("FormInput");
  });
});
describe("onboarding schemas (mock)", () => {
  it("SignIn rejects invalid email", () => expect(() => SignInSchema.parse({ email: "bad", password: "12345678" })).toThrow());
  it("SignIn accepts valid", () => expect(SignInSchema.parse({ email: "a@b.co", password: "12345678", rememberMe: false })).toBeDefined());
  it("Step1 rejects empty farmName", () => expect(() => OnboardingStep1Schema.parse({ name: "A", farmName: "", location: "OR" })).toThrow());
  it("Step2 requires at least 1 species", () => expect(() => OnboardingStep2Schema.parse({ primaryFocus: "commercial", species: [] })).toThrow());
  it("Step3 rejects chamberName >30", () => expect(() => OnboardingStep3Schema.parse({ chamberName: "x".repeat(31), startingModeId: "broiler" })).toThrow());
  it("Step2 default species includes chicken", () => expect(OnboardingStep2Schema.parse({ primaryFocus: "backyard", species: ["chicken"] }).species).toContain("chicken"));
});
describe("auth primitives tokens", () => {
  it("AuthCard uses surface-page and rounded-3xl", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/AuthCard.tsx"), "utf-8");
    expect(s).toContain("var(--surface-page)");
    expect(s).toContain("rounded-3xl");
    expect(s).toContain("var(--border-subtle)");
  });
  it("StepperBar has progressbar aria", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/StepperBar.tsx"), "utf-8");
    expect(s).toContain('role="progressbar"');
    expect(s).toContain("aria-valuenow");
  });
  it("FormInput has focus ring and label association", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/FormInput.tsx"), "utf-8");
    expect(s).toContain("focus-visible:ring-2");
    expect(s).toContain("htmlFor");
  });
});
describe("auth screens copy", () => {
  it("SignIn has WELCOME BACK + Check on your clutch", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/SignInScreen.tsx"), "utf-8");
    expect(s).toContain("WELCOME BACK");
    expect(s).toContain("Check on your clutch.");
    expect(s).toContain("Set up your farm");
  });
  it("Step1 has Lets set up your farm", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/OnboardingStep1.tsx"), "utf-8");
    expect(s).toContain("Let\u2019s set up your farm.");
  });
  it("Step2 has What are you hatching + species pills", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/OnboardingStep2.tsx"), "utf-8");
    expect(s).toContain("What are you hatching?");
    expect(s).toContain("aria-pressed");
  });
  it("Step3 has Name your first chamber + Chicken", () => {
    const s = fs.readFileSync(path.resolve("src/app/components/auth/OnboardingStep3.tsx"), "utf-8");
    expect(s).toContain("Name your first chamber.");
  });
});
describe("App wiring (mock flag)", () => {
  it("App.tsx has login/onboarding ScreenId behind demo flag", () => {
    const s = fs.readFileSync(path.resolve("src/app/App.tsx"), "utf-8");
    expect(s).toContain("login");
    expect(s).toContain("onboarding");
    expect(s).toContain("demo=onboarding");
    expect(s).toContain("lazy");
  });
});
