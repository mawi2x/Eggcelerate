import { CheckFat } from "@phosphor-icons/react";
import { type CustomIconProps, IconSvg } from "./IconBase";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Shared Phosphor CheckFat glyph. */
export function CheckIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <CheckFat size={24} color={fill} weight="fill" aria-hidden="true" />
    </IconSvg>
  );
}

/** Filled circle-check icon with independently themeable colors. */
export function FilledCheckIcon({
  size,
  color,
  foregroundColor,
  title,
  ...props
}: CustomIconProps) {
  const backgroundColor = color ?? "currentColor";
  const glyphColor = foregroundColor ?? "var(--on-brand)";

  return (
    <IconSvg {...props} size={size} title={title}>
      <circle cx="12" cy="12" r="12" fill={backgroundColor} />
      <CheckFat
        x={3}
        y={3}
        size={18}
        color={glyphColor}
        weight="fill"
        aria-hidden="true"
      />
    </IconSvg>
  );
}
