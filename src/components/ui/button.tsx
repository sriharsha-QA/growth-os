import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:     "bg-[var(--text)] text-[var(--bg)] hover:opacity-85",
        accent:      "bg-[var(--accent)] text-white hover:opacity-90",
        outline:     "border-[0.5px] border-[var(--border)] bg-transparent text-[var(--text2)] hover:bg-[var(--bg3)]",
        ghost:       "text-[var(--text2)] hover:bg-[var(--bg3)]",
        destructive: "bg-[var(--danger)] text-white hover:opacity-90",
      },
      size: {
        default: "h-10 px-4",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-12 px-6 text-base",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
