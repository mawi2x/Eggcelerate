import { type CustomIconProps, IconSvg } from "./IconBase";
import { INCUBATING_GLYPH_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Custom Incubating / Incubator icon matching the Canva asset. */
export function IncubatingIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(1.875, 1.875) scale(0.054)" fill={fill}>
        <path d={INCUBATING_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}

/** Filled circle-incubating icon with independently themeable colors. */
export function FilledIncubatingIcon({
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
      <g transform="translate(1.875, 1.875) scale(0.054)" fill={glyphColor}>
        <path d={INCUBATING_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}
