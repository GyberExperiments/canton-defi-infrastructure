/**
 * Token Selector Component
 * Красивый компонент для выбора токена с поиском и прокруткой
 */

'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { type Token } from '@/lib/near-tokens'

interface TokenSelectorProps {
  tokens: Token[]
  selectedToken: Token | null
  onSelect: (token: Token) => void
  excludeTokens?: string[] // Токены которые нужно исключить (например, уже выбранный fromToken)
  className?: string
}

export default function TokenSelector({
  tokens,
  selectedToken,
  onSelect,
  excludeTokens = [],
  className,
}: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Фильтруем токены
  const filteredTokens = useMemo(() => {
    let filtered = tokens.filter(t => !excludeTokens.includes(t.symbol))
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
      )
    }
    
    return filtered
  }, [tokens, excludeTokens, searchQuery])

  // Популярные токены (показываем первыми)
  const popularTokens = useMemo(() => {
    const popularSymbols = ['NEAR', 'USDT', 'USDC', 'ETH', 'WBTC', 'DAI', 'REF', 'stNEAR']
    return filteredTokens.filter(t => popularSymbols.includes(t.symbol))
  }, [filteredTokens])

  const otherTokens = useMemo(() => {
    const popularSymbols = ['NEAR', 'USDT', 'USDC', 'ETH', 'WBTC', 'DAI', 'REF', 'stNEAR']
    return filteredTokens.filter(t => !popularSymbols.includes(t.symbol))
  }, [filteredTokens])

  return (
    <div className={cn('relative', className)}>
      {/* Selected Token Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between gap-2",
          selectedToken
            ? "bg-white/5 text-white hover:bg-white/10"
            : "bg-gradient-to-r from-violet-500/20 to-cyan-500/20 text-white/70 hover:from-violet-500/30 hover:to-cyan-500/30 border border-white/10"
        )}
      >
        <div className="flex items-center gap-2">
          {selectedToken ? (
            <>
              <span className="text-lg">{selectedToken.icon}</span>
              <span className="text-fluid-sm md:text-fluid-base font-medium">
                {selectedToken.symbol}
              </span>
            </>
          ) : (
            <span className="text-fluid-sm md:text-fluid-base">Select token</span>
          )}
        </div>
        <ChevronDown 
          className={cn(
            "w-4 h-4 transition-transform",
            isOpen && "rotate-180"
          )} 
        />
      </button>

      {/* Dropdown Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 right-0 mt-2 glass-ultra rounded-2xl p-4 shadow-2xl z-50 max-h-[400px] overflow-hidden flex flex-col"
            >
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/50 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Token List */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {/* Popular Tokens */}
                {popularTokens.length > 0 && (
                  <div>
                    <p className="text-xs text-white/50 mb-2 px-2">Popular</p>
                    <div className="space-y-1">
                      {popularTokens.map((token) => (
                        <button
                          key={token.symbol}
                          onClick={() => {
                            onSelect(token)
                            setIsOpen(false)
                            setSearchQuery('')
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg transition-all flex items-center gap-3 text-left",
                            selectedToken?.symbol === token.symbol
                              ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/30 text-white"
                              : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <span className="text-xl">{token.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{token.symbol}</div>
                            <div className="text-xs text-white/50">{token.name}</div>
                          </div>
                          {selectedToken?.symbol === token.symbol && (
                            <div className="w-2 h-2 rounded-full bg-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Tokens */}
                {otherTokens.length > 0 && (
                  <div className={popularTokens.length > 0 ? "mt-4" : ""}>
                    {popularTokens.length > 0 && (
                      <p className="text-xs text-white/50 mb-2 px-2">All Tokens</p>
                    )}
                    <div className="space-y-1">
                      {otherTokens.map((token) => (
                        <button
                          key={token.symbol}
                          onClick={() => {
                            onSelect(token)
                            setIsOpen(false)
                            setSearchQuery('')
                          }}
                          className={cn(
                            "w-full px-3 py-2 rounded-lg transition-all flex items-center gap-3 text-left",
                            selectedToken?.symbol === token.symbol
                              ? "bg-gradient-to-r from-violet-500/30 to-cyan-500/30 text-white"
                              : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
                          )}
                        >
                          <span className="text-xl">{token.icon}</span>
                          <div className="flex-1">
                            <div className="font-medium text-sm">{token.symbol}</div>
                            <div className="text-xs text-white/50">{token.name}</div>
                          </div>
                          {selectedToken?.symbol === token.symbol && (
                            <div className="w-2 h-2 rounded-full bg-violet-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Results */}
                {filteredTokens.length === 0 && (
                  <div className="text-center py-8 text-white/50">
                    <p className="text-sm">No tokens found</p>
                    <p className="text-xs mt-1">Try a different search</p>
                  </div>
                )}
              </div>

              {/* Token Count */}
              <div className="mt-4 pt-4 border-t border-white/10 text-xs text-white/50 text-center">
                {filteredTokens.length} token{filteredTokens.length !== 1 ? 's' : ''} available
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

