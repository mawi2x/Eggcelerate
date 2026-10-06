# Checkmark icons

Use Phosphor `CheckFat` with `weight="fill"` for single checkmarks across the
frontend. Keep existing icon sizes and semantic colors.

```tsx
import { CheckFat } from "@phosphor-icons/react";

<CheckFat size={16} weight="fill" aria-hidden="true" />;
```

The shared `CheckIcon` and `FilledCheckIcon` wrappers use the same glyph;
`FilledCheckIcon` retains a separately colored circular background.
Use those wrappers when title/accessible SVG-shell behavior or two-color
circle styling is needed. Existing imported aliases also resolve to these
implementations. Keep the double-check Mark All action distinct.

Do not use Unicode checkmarks or alternative single-check drawings for new UI.
