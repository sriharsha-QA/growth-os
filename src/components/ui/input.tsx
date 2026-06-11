import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn("flex h-10 w-full rounded-lg px-3 text-sm tabular-nums disabled:opacity-50", className)}
      style={{
        border: "0.5px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text)",
        outline: "none",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.boxShadow = "0 0 0 2px color-mix(in srgb, var(--accent) 15%, transparent)"; (props.onFocus as ((e: React.FocusEvent<HTMLInputElement>) => void) | undefined)?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; (props.onBlur as ((e: React.FocusEvent<HTMLInputElement>) => void) | undefined)?.(e); }}
      {...props}
    />
  );
}
