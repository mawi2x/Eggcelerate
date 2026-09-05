import { type CustomIconProps, IconSvg } from "./IconBase";
import { REMINDER_GLYPH_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Outline reminder/checklist icon matching the Canva export. */
export function ReminderIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="scale(0.064)" fill={fill} fillRule="evenodd">
        <path d={REMINDER_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}

/** Filled circle-reminder icon with independently themeable colors. */
export function FilledReminderIcon({
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
      <g transform="scale(0.064)" fill={glyphColor} fillRule="evenodd">
        <path d={REMINDER_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}
