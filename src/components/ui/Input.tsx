import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: React.ReactNode;
  floating?: boolean;
  variant?: 'light' | 'dark';
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, icon, floating = true, value, placeholder, variant = 'light', ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(!!value);
    const isDark = variant === 'dark';

    React.useEffect(() => {
      setHasValue(!!value);
    }, [value]);

    const handleFocus = () => setIsFocused(true);
    const handleBlur = () => setIsFocused(false);

    return (
      <motion.div 
        className="relative group"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Floating label */}
        {label && floating && (
          <motion.label
            className={cn("absolute pointer-events-none font-medium origin-left z-20", icon ? "left-5" : "left-5")}
            animate={{
              y: isFocused || hasValue ? -28 : 0,
              scale: isFocused || hasValue ? 0.85 : 1,
              color: isDark 
                ? (isFocused ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.6)')
                : (isFocused ? '#374151' : 'rgba(55, 65, 81, 0.6)'),
            }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{
              top: '50%',
              transform: 'translateY(-50%)',
              transformOrigin: 'left center',
            }}
          >
            {label}
          </motion.label>
        )}

        {/* Static label */}
        {label && !floating && (
          <label 
            htmlFor={props.id} 
            className={cn(
              "block text-sm font-medium mb-3",
              isDark ? "text-white/70" : "text-gray-700"
            )}
          >
            {label}
          </label>
        )}

        {/* Ultra-modern input container */}
        <motion.div
          className="relative overflow-hidden"
          animate={{
            scale: isFocused ? 1.02 : 1,
            rotateX: isFocused ? 2 : 0,
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 30,
            duration: 0.3 
          }}
          style={{ borderRadius: '16px' }}
        >
          {/* Ultra-modern glassmorphism background */}
          {isDark ? (
            <>
              <div className="absolute inset-0 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10" />
              <div className="absolute inset-0 rounded-2xl shadow-inner shadow-black/20" />
            </>
          ) : (
            <>
          <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-white to-gray-50/80 backdrop-blur-sm rounded-2xl" />
          <div className="absolute inset-0 rounded-2xl border border-gray-200 bg-gradient-to-r from-gray-100/50 via-gray-50 to-gray-100/50" />
          <div className="absolute inset-0 rounded-2xl shadow-inner shadow-black/5" />
            </>
          )}
          
          {/* Input field */}
          <div className="relative flex items-center">
            {icon && (
              <motion.div 
                className={cn(
                  "absolute left-5 z-10 transition-colors duration-300",
                  isDark 
                    ? "text-white/70 group-focus-within:text-white" 
                    : "text-gray-500 group-focus-within:text-gray-700"
                )}
                animate={{
                  scale: isFocused ? 1.1 : 1,
                }}
                transition={{ duration: 0.2 }}
              >
                {icon}
              </motion.div>
            )}
            
            <input
              type={type}
              ref={ref}
              value={value}
              placeholder={floating ? '' : placeholder}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className={cn(
                "relative z-10 w-full h-16 bg-transparent text-lg font-medium outline-none transition-all duration-300 touch-manipulation",
                isDark 
                  ? "text-white placeholder:text-white/50" 
                  : "text-gray-900 placeholder:text-gray-500 placeholder:font-normal",
                icon ? "pl-14 pr-6" : "px-6",
                // Скрыть стрелочки в полях number
                "[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]",
                className
              )}
              {...props}
            />
          </div>

          {/* Modern focus indicator - subtle line */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-400"
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                exit={{ scaleX: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
              />
            )}
          </AnimatePresence>

          {/* Subtle top highlight */}
          {!isDark && (
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          )}
          
          {/* Micro-interaction particles effect */}
          <AnimatePresence>
            {isFocused && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="absolute w-1 h-1 bg-cyan-400/60 rounded-full"
                    style={{
                      left: `${20 + i * 30}%`,
                      top: '50%',
                    }}
                    animate={{
                      y: [-10, -20, -10],
                      opacity: [0, 1, 0],
                      scale: [0, 1, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.3,
                    }}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    )
  }
)
Input.displayName = "Input"

export { Input }