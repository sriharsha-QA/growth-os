import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-lg border border-line bg-white px-3 text-sm tabular-nums placeholder:text-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
