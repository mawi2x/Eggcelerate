import type * as React from "react";

import { cn } from "./utils";

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  size?: "compact" | "default" | "toolbar";
};

function Input({
  className,
  type,
  style,
  size = "default",
  ...props
}: InputProps) {
  const heightClass =
    size === "toolbar"
      ? "h-[var(--control-height-toolbar)]"
      : size === "compact"
        ? "h-[var(--control-height-compact)]"
        : "h-[var(--control-height-default)]";

  return (
    <input
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        heightClass,
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className,
      )}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-body)",
        fontWeight: "var(--weight-regular)",
        lineHeight: "var(--leading-normal)",
        ...style,
      }}
      {...props}
    />
  );
}

export { Input };
