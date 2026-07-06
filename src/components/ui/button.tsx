import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost" | "link" | "danger" | "success";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const baseStyles = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]";
    
    const variants = {
      default: "bg-brand-800 text-white hover:bg-brand-900 shadow-sm hover:shadow-md hover:-translate-y-0.5",
      outline: "border border-border bg-surface hover:bg-stone-50 text-brand-900 hover:text-brand-950 shadow-sm",
      ghost: "hover:bg-stone-100 text-stone-700 hover:text-brand-900",
      link: "text-brand-800 underline-offset-4 hover:underline",
      danger: "bg-danger text-white hover:bg-red-600 shadow-sm",
      success: "bg-success text-white hover:bg-teal-700 shadow-sm",
    };

    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-sm px-3 text-xs",
      lg: "h-12 rounded-md px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
