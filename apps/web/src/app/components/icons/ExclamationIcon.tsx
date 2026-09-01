import { IconSvg, type CustomIconProps } from "./IconBase";
import { EXCLAMATION_LOWER_PATH, EXCLAMATION_UPPER_PATH } from "./iconPaths";

type MonochromeIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Bare exclamation glyph from the Canva export. */
export function ExclamationIcon({
  size,
  color,
  title,
  ...props
}: MonochromeIconProps) {
  const fill = color ?? "currentColor";

  return (
    <IconSvg {...props} size={size} title={title}>
      <g transform="translate(2.625, 2.625) scale(0.050)" fill={fill}>
        <path d={EXCLAMATION_LOWER_PATH} />
        <path d={EXCLAMATION_UPPER_PATH} />
      </g>
    </IconSvg>
  );
}
