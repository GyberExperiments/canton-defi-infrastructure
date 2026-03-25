import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { motion } from "framer-motion"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/50 disabled:pointer-events-none disabled:opacity-50 overflow-hidden group",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-violet-600 via-blue-600 to-cyan-600 text-white shadow-[0_8px_32px_rgba(139,92,246,0.3)] hover:shadow-[0_12px_48px_rgba(139,92,246,0.4)]",
        secondary: "bg-white/5 text-white border border-white/20 hover:bg-white/10 backdrop-blur-2xl shadow-glass",
        ghost: "hover:bg-white/5 text-white backdrop-blur-xl",
        outline: "border-2 border-violet-500/50 text-violet-300 hover:bg-violet-500/10 backdrop-blur-xl",
        liquid: "bg-gradient-to-r from-violet-500/20 via-blue-500/20 to-cyan-500/20 backdrop-blur-2xl border border-white/20 text-white hover:from-violet-500/30 hover:via-blue-500/30 hover:to-cyan-500/30",
      },
      size: {
        default: "h-14 px-6 py-4 text-base",
        sm: "h-12 px-4 py-3 text-sm",
        lg: "h-16 px-8 py-5 text-lg",
        icon: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 
    'onDrag' | 'onDragEnd' | 'onDragStart' | 'onAnimationStart' | 'onAnimationEnd'>,
    VariantProps<typeof buttonVariants> {
  magnetic?: boolean;
  shimmer?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>
  (({ className, variant, size, magnetic = true, shimmer = true, children, ...props }, ref) => {
    const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });
    const buttonRef = React.useRef<HTMLButtonElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!magnetic || !buttonRef.current || typeof window === 'undefined') return;
      
      const rect = buttonRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 20;
      setMousePosition({ x, y });
    };

    const handleMouseLeave = () => {
      setMousePosition({ x: 0, y: 0 });
    };

    return (
      <motion.button
        ref={(el) => {
          if (buttonRef && 'current' in buttonRef) buttonRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref && 'current' in ref) ref.current = el;
        }}
        className={cn(buttonVariants({ variant, size }), "touch-manipulation", className)}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={{
          x: mousePosition.x,
          y: mousePosition.y,
        }}
        whileHover={{ 
          scale: 1.05,
          y: -2,
        }}
        whileTap={{ scale: 0.95 }}
        transition={{ 
          type: 'spring', 
          stiffness: 300, 
          damping: 30,
          x: { type: 'spring', stiffness: 400, damping: 25 },
          y: { type: 'spring', stiffness: 400, damping: 25 }
        }}
        {...props}
      >
        {/* Prismatic border effect */}
        {variant === 'default' && (
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-400/50 via-blue-400/50 to-cyan-400/50 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
        )}
        
        {/* Shimmer effect */}
        {shimmer && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ['-200%', '200%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        )}
        
        {/* Ripple on click */}
        <motion.div
          className="absolute inset-0 rounded-xl bg-white/10"
          initial={{ scale: 0, opacity: 0 }}
          whileTap={{ scale: 2, opacity: [0.5, 0] }}
          transition={{ duration: 0.5 }}
        />
        
        {/* Content */}
        <span className="relative z-10 font-bold">
          {children}
        </span>
      </motion.button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
