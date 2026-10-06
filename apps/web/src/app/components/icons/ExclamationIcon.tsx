import { faExclamation } from "@fortawesome/free-solid-svg-icons";
import type { CustomIconProps } from "./IconBase";

type ExclamationIconProps = Omit<CustomIconProps, "foregroundColor">;

/** Official Font Awesome glyph rendered directly without the runtime SVG engine. */
export function ExclamationIcon({
  size = 24,
  color,
  title,
  ...props
}: ExclamationIconProps) {
  const ariaLabel = props["aria-label"];
  const ariaLabelledBy = props["aria-labelledby"];
  const hasAccessibleName = Boolean(title || ariaLabel || ariaLabelledBy);
  const { style, role, ...svgProps } = props;

  return (
    <svg
      viewBox={`0 0 ${faExclamation.icon[0]} ${faExclamation.icon[1]}`}
      width={`${faExclamation.icon[0] / faExclamation.icon[1]}em`}
      height="1em"
      fill="currentColor"
      focusable="false"
      {...svgProps}
      role={role ?? (hasAccessibleName ? "img" : undefined)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-hidden={hasAccessibleName ? undefined : true}
      style={{ ...style, fontSize: size, color: color ?? style?.color }}
    >
      {title ? <title>{title}</title> : null}
      {(Array.isArray(faExclamation.icon[4])
        ? faExclamation.icon[4]
        : [faExclamation.icon[4]]
      ).map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}
