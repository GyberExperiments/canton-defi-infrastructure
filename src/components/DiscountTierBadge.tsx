/**
 * Discount Tier Badge Component
 * Отображение текущего уровня скидки
 */

'use client';

import { motion } from 'framer-motion';
import { Trophy, TrendingUp } from 'lucide-react';
import { getDiscountTier, DISCOUNT_TIERS } from '@/config/otc';

interface DiscountTierBadgeProps {
  usdAmount: number;
}

const tierColors = {
  Standard: { bg: 'from-gray-500 to-gray-600', text: 'text-gray-100' },
  Bronze: { bg: 'from-amber-600 to-amber-700', text: 'text-amber-100' },
  Silver: { bg: 'from-gray-400 to-gray-500', text: 'text-gray-100' },
  Gold: { bg: 'from-yellow-500 to-yellow-600', text: 'text-yellow-100' },
};

export default function DiscountTierBadge({ usdAmount }: DiscountTierBadgeProps) {
  if (usdAmount <= 0) return null;

  const currentTier = getDiscountTier(usdAmount);
  const nextTier = DISCOUNT_TIERS.find(t => t.minAmount > usdAmount);
  const colors = tierColors[currentTier.label as keyof typeof tierColors];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6"
    >
      {/* Current Tier */}
      <motion.div
        className={`relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r ${colors.bg} shadow-lg`}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Trophy className={`w-8 h-8 ${colors.text}`} />
            </motion.div>
            <div>
              <h3 className={`text-2xl font-black ${colors.text}`}>
                {currentTier.label} Tier
              </h3>
              <p className={`text-sm ${colors.text} opacity-90`}>
                {currentTier.discount > 0 
                  ? `+${(currentTier.discount * 100).toFixed(1)}% Discount` 
                  : 'Standard Rate'}
              </p>
            </div>
          </div>
          {currentTier.discount > 0 && (
            <div className={`text-4xl font-black ${colors.text}`}>
              +{(currentTier.discount * 100).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Shimmer effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
          animate={{ x: ['-200%', '200%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>

      {/* Next Tier Progress */}
      {nextTier && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-4 p-4 bg-white/5 rounded-xl backdrop-blur-sm border border-white/10"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white/70 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Next tier: {nextTier.label}
            </span>
            <span className="text-sm font-bold text-white/90">
              ${nextTier.minAmount.toLocaleString()} needed
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-cyan-500"
              initial={{ width: 0 }}
              animate={{ 
                width: `${Math.min(100, (usdAmount / nextTier.minAmount) * 100)}%` 
              }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          
          <p className="text-xs text-white/60 mt-2">
            Add ${(nextTier.minAmount - usdAmount).toLocaleString()} more for +{(nextTier.discount * 100).toFixed(1)}% discount
          </p>
        </motion.div>
      )}

      {/* All Tiers Info */}
      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DISCOUNT_TIERS.map((tier) => (
          <div
            key={tier.label}
            className={`text-center p-3 rounded-lg transition-all ${
              tier.label === currentTier.label
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 border border-white/5'
            }`}
          >
            <div className="text-xs font-bold text-white/70">{tier.label}</div>
            <div className="text-sm font-black text-white mt-1">
              {tier.discount > 0 ? `+${(tier.discount * 100).toFixed(1)}%` : '0%'}
            </div>
            <div className="text-[10px] text-white/50 mt-1">
              ${tier.minAmount}+
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}



