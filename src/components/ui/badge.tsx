import * as React from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  ahead: "bg-accent/10 text-accent",
  on_track: "bg-info/10 text-info",
  recoverable: "bg-warn/10 text-warn",
  recalibrate: "bg-danger/10 text-danger",
  neutral: "bg-ink/5 text-muted",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}
      {...props}
    />
  );
}
