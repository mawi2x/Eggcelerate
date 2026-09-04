import { type CustomIconProps, IconSvg } from "./IconBase";
import { CHECK_GLYPH_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Chunky checkmark icon matching the Canva asset. */
export function CheckIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(3, 3) scale(0.048)" fill={fill}>
        <path d={CHECK_GLYPH_PATH} />
      </g>
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
  const glyphColor = foregroundColor ?? "var(--on-brand, #FFFFFF)";

  return (
    <IconSvg {...props} size={size} title={title}>
      <circle cx="12" cy="12" r="12" fill={backgroundColor} />
      <g transform="translate(3, 3) scale(0.048)" fill={glyphColor}>
        <path d={CHECK_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}
