"use client";

import * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";

import { cn } from "./utils";

function Label({
  className,
  style,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--type-body)",
        fontWeight: "var(--weight-medium)",
        lineHeight: "var(--leading-snug)",
        ...style,
      }}
      {...props}
    />
  );
}

export { Label };
