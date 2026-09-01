import { IconSvg, type CustomIconProps } from "./IconBase";
import { EXCLAMATION_LOWER_PATH, EXCLAMATION_UPPER_PATH } from "./iconPaths";

/** Filled circle-exclamation icon with independently themeable colors. */
export function FilledExclamationIcon({
  size,
  color,
  foregroundColor,
  title,
  ...props
}: CustomIconProps) {
  const backgroundColor = color ?? "currentColor";
  const glyphColor = foregroundColor ?? "var(--on-brand, #FFFFFF)";

  return (
    <IconSvg {...props} size={size} title={title}>
      <circle cx="12" cy="12" r="12" fill={backgroundColor} />
      <g transform="translate(2.625, 2.625) scale(0.050)" fill={glyphColor}>
        <path d={EXCLAMATION_LOWER_PATH} />
        <path d={EXCLAMATION_UPPER_PATH} />
      </g>
    </IconSvg>
  );
}
