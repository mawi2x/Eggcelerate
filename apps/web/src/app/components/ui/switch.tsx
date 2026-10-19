"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as React from "react";

import { cn } from "./utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    data-slot="switch"
    className={cn(
      "group inline-flex size-[var(--control-hit-area-icon)] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent p-0 outline-none focus-visible:ring-ring/50 focus-visible:ring-[length:var(--focus-ring-width)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <span aria-hidden="true" className="pointer-events-none relative inline-flex h-[1.15rem] w-8 items-center rounded-full border border-transparent bg-switch-background transition-colors group-data-[state=checked]:bg-primary">
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-4 rounded-full bg-card shadow-sm transition-transform data-[state=checked]:translate-x-[calc(100%-2px)] data-[state=unchecked]:translate-x-0"
      />
    </span>
  </SwitchPrimitive.Root>
));

Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
