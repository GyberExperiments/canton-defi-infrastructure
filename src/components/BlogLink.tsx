'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react'

/**
 * Creative Blog Link Component
 * Attractive, animated component to link to blog from homepage
 */
export default function BlogLink() {
  return (
    <motion.div
      className="relative group"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.6 }}
    >
      <Link
        href="/blog"
        className="relative block overflow-hidden rounded-2xl bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 backdrop-blur-xl border border-white/10 p-6 md:p-8 hover:border-white/30 transition-all duration-300"
      >
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/0 via-pink-600/20 to-blue-600/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        {/* Sparkle effects */}
        <motion.div
          className="absolute top-4 right-4"
          animate={{
            rotate: [0, 180, 360],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <Sparkles className="w-6 h-6 text-yellow-400 opacity-60" />
        </motion.div>

        <div className="relative z-10">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 backdrop-blur-sm">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-purple-300 group-hover:to-pink-300 transition-all duration-300">
                📚 Learn About Canton Network
              </h3>
              <p className="text-white/70 text-sm md:text-base mb-4">
                Explore our blog with guides, tutorials, and insights about Canton Coin, Canton Network, and the future of enterprise DeFi.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <span>Latest articles</span>
              <span>•</span>
              <span>Expert insights</span>
            </div>
            <motion.div
              className="flex items-center gap-2 text-white font-semibold"
              whileHover={{ x: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <span>Read Blog</span>
              <ArrowRight className="w-5 h-5" />
            </motion.div>
          </div>
        </div>

        {/* Hover glow effect */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-purple-500/0 via-pink-500/20 to-blue-500/0 opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-500 -z-10" />
      </Link>
    </motion.div>
  )
}

