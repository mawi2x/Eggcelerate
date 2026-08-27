# Auth & Onboarding Guide (Prep — Mock)

> Mock-only prep per `docs/screens/auth-and-onboarding-plan.md:1` — 4 screens behind `?demo=onboarding`. No JWT `Task 7` yet. Flip to real auth is `App.tsx` 1-line guard swap.

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

**Mock flag:** `?demo=onboarding` → `?screen=login` `?screen=onboarding&step=1` else `overview` default. No `POST /api/auth/login` — `onSetup` just `navigate`.

**When to flip:** Replace `if (params.get("demo")==="onboarding")` with `if (!user)` `ProtectedRoute` `Task 7`.

<!-- mock-only -->
