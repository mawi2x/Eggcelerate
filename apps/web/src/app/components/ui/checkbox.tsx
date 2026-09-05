"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "./utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-mini)] border-0 bg-transparent p-0 text-primary-foreground shadow-none transition-shadow outline-none before:pointer-events-none before:absolute before:size-4 before:rounded-[var(--radius-mini)] before:border before:border-input before:bg-input-background before:shadow-xs before:transition-colors focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive data-[state=checked]:before:border-primary data-[state=checked]:before:bg-primary dark:before:bg-input/30 dark:data-[state=checked]:before:bg-primary cursor-pointer hover:before:border-primary disabled:cursor-not-allowed disabled:opacity-50 md:size-4",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
