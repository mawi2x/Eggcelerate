import { type CustomIconProps, IconSvg } from "./IconBase";
import { INFO_GLYPH_LOWER_PATH, INFO_GLYPH_UPPER_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Bare information glyph from the Canva export. */
export function InfoIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(2.625, 2.625) scale(0.050)" fill={fill}>
        <path d={INFO_GLYPH_LOWER_PATH} />
        <path d={INFO_GLYPH_UPPER_PATH} />
      </g>
    </IconSvg>
  );
}

/** Filled circle-info icon with independently themeable colors. */
export function CircleInfoIcon({
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
        <path d={INFO_GLYPH_LOWER_PATH} />
        <path d={INFO_GLYPH_UPPER_PATH} />
      </g>
    </IconSvg>
  );
}
