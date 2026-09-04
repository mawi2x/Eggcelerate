import { type CustomIconProps, IconSvg } from "./IconBase";
import { INCUBATOR_DEVICE_GLYPH_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Custom Incubator chamber device icon matching the Canva asset. */
export function IncubatorDeviceIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(2.625, 2.625) scale(0.050)" fill={fill}>
        <path d={INCUBATOR_DEVICE_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}

/** Filled circle-incubator device icon with independently themeable colors. */
export function FilledIncubatorDeviceIcon({
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
        <path d={INCUBATOR_DEVICE_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}
