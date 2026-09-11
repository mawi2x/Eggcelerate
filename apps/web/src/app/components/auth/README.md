# components/auth — Mock Prep

```
AuthCard      — centered modal shell, brand header `logo-app.webp` `var(--brand-primary)`
StepperBar    — `STEP X OF 3` + `I have an account` → `role="progressbar"` `aria-valuenow`
FormInput     — label `htmlFor` + `Icon` + `focus-visible:ring-2` + error `aria-describedby`
SignIn        — `WELCOME BACK` `Check on your clutch.` `Sign in →` `bg-[var(--brand-primary)]`
Step1         — `Let's set up your farm.` 3 inputs `User/Feather/MapPin`
Step2         — `What are you hatching?` 2x2 `Egg/Feather/Sparkles/Flask` + pills `aria-pressed`
Step3         — `Name your first chamber.` card `Chicken (Standard)` `37.5°C, 55% RH`
```

All new UI uses `var(--*)` only `color-guidelines.md:7` + `var(--type-*)` `typography-guidelines.md:44`. Illustration creams `bg-[#FDF8EE] border-[#F5E6CC]` are exception with comment `// illustration exception per color-guidelines.md:163`.
