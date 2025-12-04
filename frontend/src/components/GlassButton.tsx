import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { motion, HTMLMotionProps } from "framer-motion";

export interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: "primary" | "secondary" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant = "primary", size = "default", children, ...props }, ref) => {
    const variants = {
      primary: "glass glow-teal hover:glow-violet bg-primary/20 text-primary-foreground border-primary/30",
      secondary: "glass bg-secondary/20 text-secondary-foreground border-secondary/30 hover:bg-secondary/30",
      outline: "glass border-border hover:bg-foreground/5",
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          "rounded-xl font-medium transition-all duration-300",
          {
            "px-6 py-3": size === "default" || !size,
            "px-3 py-1.5 text-sm": size === "sm",
            "px-8 py-4 text-lg": size === "lg",
            "p-2": size === "icon"
          },
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);

GlassButton.displayName = "GlassButton";
