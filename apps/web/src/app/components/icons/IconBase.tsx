import type { ReactNode, SVGProps } from "react";

export type CustomIconProps = Omit<SVGProps<SVGSVGElement>, "color" | "title"> & {
  size?: number | string;
  color?: string;
  foregroundColor?: string;
  title?: string;
  strokeWidth?: number | string;
};

type IconSvgProps = Omit<CustomIconProps, "color" | "foregroundColor"> & {
  children: ReactNode;
};

/** Shared SVG shell for custom icons. Unlabelled icons are decorative by default. */
export function IconSvg({
  size = 24,
  title,
  children,
  ...props
}: IconSvgProps) {
  const {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    role,
    ...svgProps
  } = props;
  const hasAccessibleName = Boolean(title || ariaLabel || ariaLabelledBy);

  return (
    <svg
      {...svgProps}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={role ?? (hasAccessibleName ? "img" : undefined)}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-hidden={hasAccessibleName ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}
