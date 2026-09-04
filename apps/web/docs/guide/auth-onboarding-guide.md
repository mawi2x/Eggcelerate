# Auth & Onboarding Guide (Routed Mock Boundary)

> Mock-only prep per `docs/screens/auth-and-onboarding-plan.md:1` — sign-in and onboarding use public Wouter routes at `/login` and `/onboarding/:step`. No JWT or server session exists yet.

**Folder map:**

```
components/auth/
├── AuthCard.tsx      # shell `min-h-screen bg-[var(--surface-page)]` + `max-w-[440px] rounded-3xl` + brand `var(--brand-primary)` — illustration creams `bg-[#FDF8EE] border-[#F5E6CC]` are exception per color-guidelines.md:163
├── StepperBar.tsx    # `STEP X OF 3` + `role="progressbar" aria-valuenow` `var(--brand-primary)` vs `var(--surface-muted)`
├── FormInput.tsx     # label `var(--type-label)` `var(--tracking-label)` uppercase + input `var(--type-body)` `focus-visible:ring-2 ring-[var(--ring)]` + `aria-describedby` error `var(--status-danger-fg)`
├── SignInScreen.tsx
├── OnboardingStep1.tsx
├── OnboardingStep2.tsx  # 2x2 focus `aria-pressed` + pills `aria-pressed`
└── OnboardingStep3.tsx  # card `border-[#F5E6CC] bg-[#FFFDF9]` `var(--type-label)` preview
data/onboarding.ts # OnboardingState + PrimaryFocus + zod schemas using caps from account.ts:10 + Result<T> dto.ts:3
```

**Tokens:** `AuthCard` `bg-[var(--surface-page)]` `rounded-3xl` `border-[var(--border-subtle)]` `var(--brand-primary)` `var(--type-page-title)` `var(--type-body)` `var(--type-label)` `var(--weight-bold)` `var(--tracking-label)` `var(--leading-snug)` `var(--ring)` `var(--status-danger-fg)`.

**Mock routing:** `/login` and `/onboarding/1` through `/onboarding/3` are public. Dashboard routes are wrapped in `RequireAuth`, backed by `MockAuthProvider`, and default to an authenticated farmer to preserve the existing frontend demo. Legacy `?demo=onboarding&screen=...` links are replaced with their canonical route once at startup. No `POST /api/auth/login` exists.

**When to flip:** Replace the mock provider implementation with the future cookie-backed auth adapter. Keep `RequireAuth` and the screen routes; the API remains the security authority.

<!-- mock-only -->
