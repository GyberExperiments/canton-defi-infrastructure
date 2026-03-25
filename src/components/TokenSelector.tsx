'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Check } from 'lucide-react'
import { TokenConfig, SUPPORTED_TOKENS, getTokenKey } from '@/config/otc'
import { useLimits } from './ConfigProvider'
import { cn } from '@/lib/utils'

interface TokenSelectorProps {
  id?: string;
  selectedToken: TokenConfig | null;
  onTokenSelect: (token: TokenConfig) => void;
  className?: string;
  exchangeDirection?: 'buy' | 'sell';
}

export default function TokenSelector({ id, selectedToken, onTokenSelect, className, exchangeDirection = 'buy' }: TokenSelectorProps) {
  console.log('TokenSelector render, exchangeDirection:', exchangeDirection)
  const [isOpen, setIsOpen] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  // ✅ Получаем динамические лимиты из конфигурации
  const { minUsdtAmount } = useLimits()

  const handleSelect = (token: TokenConfig) => {
    onTokenSelect(token)
    setIsOpen(false)
  }

  // Calculate dropdown position when opening - Mobile optimized
  useEffect(() => {
    if (isOpen && buttonRef.current && typeof window !== 'undefined') {
      const rect = buttonRef.current.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth
      const dropdownHeight = 400 // Estimated dropdown height
      
      // Check if dropdown fits below button
      const fitsBelow = rect.bottom + dropdownHeight + 12 < viewportHeight
      
      // Check if dropdown fits to the right
      const fitsRight = rect.left + rect.width + 12 < viewportWidth
      
      const position = {
        top: fitsBelow ? rect.bottom + 12 : Math.max(12, rect.top - dropdownHeight - 12),
        left: fitsRight ? rect.left : Math.max(12, viewportWidth - rect.width - 12),
        width: Math.min(rect.width, viewportWidth - 24) // Ensure dropdown doesn't exceed viewport
      }
      
      setDropdownPosition(position)
    }
  }, [isOpen])

  return (
    <div className={cn("relative", className)} style={{ position: 'relative', zIndex: 1000 }}>
      {/* Main Button */}
      <button
        id={id}
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-white/10 to-white/5 backdrop-blur-xl border border-white/30 rounded-xl hover:border-violet-400/70 hover:from-white/15 hover:to-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-violet-400/40 shadow-lg hover:shadow-xl min-h-[80px] touch-manipulation"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="token-selector-dropdown"
        aria-label="Select payment token"
        role="combobox"
      >
        <div className="flex items-center gap-4">
          {selectedToken ? (
            <>
              <div 
                className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shadow-lg flex-shrink-0"
                style={{ 
                  backgroundColor: selectedToken.color + '25', 
                  color: selectedToken.color,
                  border: `2px solid ${selectedToken.color}40`,
                  boxShadow: `0 0 15px ${selectedToken.color}25`
                }}
              >
                {selectedToken.icon}
              </div>
              <div className="text-left min-w-0 flex-1">
                <div className="flex flex-col gap-2">
                  <div className="font-bold text-white text-lg">
                    {selectedToken.symbol}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span 
                      className="text-xs px-3 py-1 rounded-lg font-medium inline-block"
                      style={{ 
                        backgroundColor: selectedToken.color + '20', 
                        color: selectedToken.color,
                        border: `1px solid ${selectedToken.color}30`
                      }}
                    >
                      {selectedToken.networkName}
                    </span>
                    <div className="text-sm text-white/70">{selectedToken.name}</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/70 font-medium">{exchangeDirection === 'buy' ? 'Select payment token' : 'Select receivable token'}</div>
          )}
        </div>
        <ChevronDown className={cn(
          "w-5 h-5 text-white/60 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown - Rendered via Portal */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ 
              duration: 0.2, 
              ease: "easeOut",
              type: "tween"
            }}
            className="fixed"
            style={{ 
              position: 'fixed',
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: dropdownPosition.width,
              zIndex: 99999
            }}
            id="token-selector-dropdown"
            role="listbox"
            aria-label="Available payment tokens"
          >
              {/* Ultra Modern 2025 Dark Glass Container - Mobile Optimized */}
              <div className="relative bg-gradient-to-b from-slate-900/98 to-slate-950/98 backdrop-blur-3xl border border-white/50 rounded-xl shadow-2xl overflow-hidden max-h-[80vh] overflow-y-auto">
                {/* Ultra Modern 2025 Prismatic border effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-violet-500/30 via-blue-500/30 to-cyan-500/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Enhanced ultra-modern shadows for perfect isolation */}
                <div className="absolute inset-0 rounded-xl shadow-[0_35px_100px_rgba(0,0,0,0.8),0_20px_60px_rgba(30,64,175,0.4),0_12px_30px_rgba(6,182,212,0.3),0_6px_15px_rgba(139,92,246,0.2)]" />
                
                {/* Enhanced inner highlight */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />
                
                {/* Ultra Modern 2025 outer glow for maximum separation */}
                <div className="absolute -inset-2 rounded-xl bg-gradient-to-r from-violet-500/15 via-blue-500/15 to-cyan-500/15 blur-md" />
                
                {/* Additional depth layer for ultra-modern effect */}
                <div className="absolute -inset-3 rounded-xl bg-gradient-to-r from-slate-900/20 via-slate-800/20 to-slate-900/20 blur-lg" />
                
                {/* Content Container */}
                <div className="relative z-10 p-3">
              {SUPPORTED_TOKENS.map((token) => {
                const isSelected = selectedToken && getTokenKey(token) === getTokenKey(selectedToken)
                
                return (
                      <motion.button
                    key={getTokenKey(token)}
                    onClick={() => handleSelect(token)}
                    className={cn(
                          "w-full flex items-center justify-between p-4 rounded-xl transition-all duration-300 group relative overflow-hidden min-h-[60px] touch-manipulation",
                      isSelected 
                            ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/20 border border-violet-400/50 shadow-lg ring-1 ring-violet-400/30" 
                            : "hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5 hover:border-white/30 border border-transparent"
                    )}
                    role="option"
                    aria-selected={isSelected || false}
                    aria-label={`${token.symbol} on ${token.networkName} network`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {/* Shimmer effect on hover */}
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                          initial={{ x: '-100%' }}
                          whileHover={{ x: '200%' }}
                          transition={{ duration: 0.6 }}
                        />
                        
                        <div className="flex items-center gap-4 min-w-0 flex-1 relative z-10">
                          <div 
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold shadow-lg transition-all duration-200 group-hover:scale-110 flex-shrink-0"
                        style={{ 
                          backgroundColor: token.color + '25', 
                          color: token.color,
                          border: `2px solid ${token.color}40`,
                          boxShadow: `0 0 20px ${token.color}30`
                        }}
                      >
                        {token.icon}
                      </div>
                      <div className="text-left min-w-0 flex-1">
                            <div className="flex flex-col gap-1">
                              <div className="font-bold text-white text-lg group-hover:text-violet-100 transition-colors">
                                {token.symbol}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span 
                                  className="text-xs px-2 py-0.5 rounded-md font-medium transition-all duration-200 inline-block"
                                  style={{ 
                                    backgroundColor: token.color + '30', 
                                    color: token.color,
                                    border: `1px solid ${token.color}50`
                                  }}
                                >
                                  {token.networkName}
                                </span>
                                <div className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{token.name}</div>
                              </div>
                            </div>
                      </div>
                    </div>
                    
                        <div className="text-right flex-shrink-0 relative z-10">
                          <div className="text-sm font-bold text-green-400 group-hover:text-green-300 transition-colors">
                            ${token.priceUSD.toLocaleString()}
                          </div>
                          <div className="text-xs text-white/90 group-hover:text-white transition-colors">
                            Min: {minUsdtAmount || token.minAmount} {token.symbol}
                          </div>
                        </div>
                    
                    {isSelected && (
                          <motion.div 
                            className="ml-3 w-6 h-6 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500 }}
                          >
                        <Check className="w-4 h-4 text-white" />
                          </motion.div>
                    )}
                      </motion.button>
                )
              })}
            </div>
            
                {/* Footer with enhanced design */}
                <div className="px-4 py-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-t border-white/30">
                  <div className="text-xs text-white text-center font-medium flex items-center justify-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-500 to-cyan-500 animate-pulse" />
                    Choose your preferred payment method and network
                  </div>
                </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}

      {/* Ultra Modern 2025 Backdrop Overlay - Also via Portal */}
      {isOpen && typeof window !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm" 
          style={{ zIndex: 99998 }}
          onClick={() => setIsOpen(false)}
        />,
        document.body
      )}
    </div>
  )
}