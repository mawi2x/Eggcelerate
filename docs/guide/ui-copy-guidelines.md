# UI wording

Use readable phrases and sentences throughout the owner dashboard and admin UI.
These conventions apply to captions, tooltips, summaries, help and validation
messages as well as main page text.

## Numeric ranges

- Write **to**, not a hyphen or an en dash, between range endpoints.
- Temperature example: **37.5 to 37.8°C** (or the corresponding Fahrenheit range).
- Humidity example: **55 to 60% RH**.
- Counts/days/password examples: **1 to 20 of 50**, **Days 18 to 21**, and
  **12 to 128 characters**.
- Use the shared temperature formatter so conversions, one decimal place and
  range wording remain consistent. Do not reconstruct a temperature range in a
  component with its own separator.
- Keep measured values and thresholds unchanged. Only presentation wording
  changes; timestamps, IDs, pairing codes and numeric subtraction are not ranges.

## Summaries and metadata

- Do not concatenate information with middle-dot separators.
- Use sentence structure, words such as **and**, or separate labelled rows.
- Preparation example: **For Broiler, the target temperature is 37.5 to 37.8°C
  and the target humidity is 55 to 60% RH.**
- Alert status example: **Resolved after recovery**.
- Upload help example: **Use JPG, PNG or WebP files up to 2 MB.**
- Keep chart/table labels concise: **Range** rather than **Min–max**.
- Periods are normal sentence punctuation; the rule concerns decorative
  separators. Missing-data placeholders are separate from range notation.

Existing stored alerts may contain older dash ranges. The frontend normalizes
those message ranges for display without editing historical records. New server
alert messages use **to** directly.
