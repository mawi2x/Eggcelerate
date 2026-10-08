# components/auth — Mock Prep

```
AuthCard      — centered modal shell, brand header `logo-app.webp` `var(--brand-primary)`
StepperBar    — `STEP X OF 2` + `I have an account` → `role="progressbar"` `aria-valuenow`
FormInput     — label `htmlFor` + `Icon` + `focus-visible:ring-2` + error `aria-describedby`
SignIn        — `WELCOME BACK` `Sign in` `bg-[var(--brand-primary)]`
Step1         — `Let's set up your farm.` Name and farm inputs with 32-character counters
Step2         — `Connect your first chamber.` Demo chamber code and chamber name inputs (OnboardingStep3 component); physical code verification remains pending
```

All new UI uses `var(--*)` only `color-guidelines.md:7` + `var(--type-*)` `typography-guidelines.md:44`. Illustration creams `bg-[#FDF8EE] border-[#F5E6CC]` are exception with comment `// illustration exception per color-guidelines.md:163`.
