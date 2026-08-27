import { describe, it, expect } from "vitest";
import fs from "fs"; import path from "path";
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
