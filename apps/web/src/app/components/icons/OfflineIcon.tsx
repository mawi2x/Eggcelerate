import { IconSvg, type CustomIconProps } from "./IconBase";
import { OFFLINE_GLYPH_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Custom Offline / Wi-Fi disconnected icon matching the Canva asset. */
export function OfflineIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(2.625, 2.625) scale(0.050)" fill={fill}>
        <path d={OFFLINE_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}

/** Filled circle-offline icon with independently themeable colors. */
export function FilledOfflineIcon({
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
        <path d={OFFLINE_GLYPH_PATH} />
      </g>
    </IconSvg>
  );
}
