import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GlassCardProps {
  className?: string;
  hover?: boolean;
  children?: ReactNode;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, hover = false, children }, ref) => {
    if (!hover) {
      return (
        <div
          ref={ref}
          className={cn("glass rounded-2xl p-6 transition-all duration-300", className)}
        >
          {children}
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.02, y: -5 }}
        transition={{ duration: 0.2 }}
        className={cn("glass rounded-2xl p-6 transition-all duration-300", className)}
      >
        {children}
      </motion.div>
    );
  }
);

GlassCard.displayName = "GlassCard";
