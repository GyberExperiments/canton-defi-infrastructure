'use client'

import React from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Shield, Zap, Globe, Users, Award, TrendingUp, Lock, Sparkles } from 'lucide-react'

const stats = [
  { label: 'Total Volume', value: '$50M+', icon: TrendingUp },
  { label: 'Active Traders', value: '10,000+', icon: Users },
  { label: 'Countries Served', value: '150+', icon: Globe },
  { label: 'Uptime', value: '99.9%', icon: Zap },
]

const values = [
  {
    icon: Shield,
    title: 'Security First',
    description: 'Multi-layer security protocols, smart contract audits, and cold storage protect your assets.'
  },
  {
    icon: Zap,
    title: 'Instant Trading',
    description: 'Automated OTC processing ensures you get your Canton Coins within minutes, not hours.'
  },
  {
    icon: Globe,
    title: 'Global Access',
    description: 'Trade from anywhere in the world with support for multiple networks and currencies.'
  },
  {
    icon: Award,
    title: 'Best Rates',
    description: 'Deep liquidity pools and direct OTC trading ensure competitive prices for all trades.'
  },
]

const milestones = [
  { year: '2023', event: 'Canton OTC Exchange founded', description: 'Started with a vision to make Canton Coin accessible to everyone' },
  { year: '2023 Q3', event: 'Multi-network support added', description: 'Expanded to support ETH, BSC, TRON, and Solana networks' },
  { year: '2024 Q1', event: '$10M trading volume', description: 'Reached significant milestone in quarterly trading volume' },
  { year: '2024 Q2', event: 'Instant settlement launched', description: 'Introduced automated smart contract processing' },
  { year: '2024 Q3', event: '24/7 support added', description: 'Expanded customer service to round-the-clock availability' },
  { year: '2024 Q4', event: '$50M total volume', description: 'Celebrating major growth and community trust' },
]

export default function AboutContent() {
  return (
    <div className="min-h-screen py-12">
      {/* Hero Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto px-4 mb-20"
      >
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            About Canton OTC Exchange
          </h1>
          <p className="text-xl text-gray-300 mb-8 leading-relaxed">
            Your trusted gateway to Canton Coin trading. We&apos;re building the future of decentralized finance, 
            one transaction at a time.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Lock className="w-4 h-4 text-green-400" />
              <span className="text-sm">Secure Platform</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              <span className="text-sm">Trusted by Thousands</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Stats Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="container mx-auto px-4 mb-20"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 text-center hover:border-purple-500/30 transition-all"
            >
              <stat.icon className="w-8 h-8 mx-auto mb-3 text-purple-400" />
              <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Mission Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="container mx-auto px-4 mb-20"
      >
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 backdrop-blur-xl rounded-3xl border border-white/10 p-8 md:p-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">Our Mission</h2>
            <p className="text-lg text-gray-300 text-center leading-relaxed">
              Canton OTC Exchange is dedicated to providing the most secure, efficient, and user-friendly 
              platform for trading Canton Coin. We believe in the transformative power of blockchain technology 
              and are committed to making it accessible to everyone, regardless of their technical expertise 
              or geographic location.
            </p>
          </div>
        </div>
      </motion.section>

      {/* Values Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="container mx-auto px-4 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Our Core Values</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {values.map((value, index) => (
            <motion.div
              key={value.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 hover:border-purple-500/30 transition-all"
            >
              <value.icon className="w-12 h-12 mb-4 text-purple-400" />
              <h3 className="text-xl font-bold mb-3">{value.title}</h3>
              <p className="text-gray-300">{value.description}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Timeline Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="container mx-auto px-4 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Our Journey</h2>
        <div className="max-w-4xl mx-auto">
          <div className="space-y-8">
            {milestones.map((milestone, index) => (
              <motion.div
                key={milestone.year}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.05 }}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-24 text-right">
                  <div className="text-sm font-bold text-purple-400">{milestone.year}</div>
                </div>
                <div className="flex-shrink-0 w-4 h-4 bg-purple-500 rounded-full mt-1 relative">
                  {index !== milestones.length - 1 && (
                    <div className="absolute top-4 left-1/2 w-0.5 h-24 bg-purple-500/30 -translate-x-1/2" />
                  )}
                </div>
                <div className="flex-grow">
                  <h3 className="text-lg font-bold mb-1">{milestone.event}</h3>
                  <p className="text-gray-400 text-sm">{milestone.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Technology Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="container mx-auto px-4 mb-20"
      >
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Our Technology</h2>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
            <h3 className="text-xl font-bold mb-4">Smart Contract Architecture</h3>
            <p className="text-gray-300 mb-4">
              Our platform leverages audited smart contracts to ensure transparent, trustless transactions. 
              Every trade is executed automatically without manual intervention.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Multi-signature wallet protection</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Automated price oracle integration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Emergency pause mechanisms</span>
              </li>
            </ul>
          </div>
          
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
            <h3 className="text-xl font-bold mb-4">Multi-Chain Support</h3>
            <p className="text-gray-300 mb-4">
              Canton OTC supports multiple blockchain networks, giving you flexibility in how you trade 
              and manage your assets.
            </p>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Ethereum, BSC, TRON, Solana, Optimism</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Cross-chain bridge integration</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span>Unified liquidity pools</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="container mx-auto px-4"
      >
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-600/20 backdrop-blur-xl rounded-3xl border border-white/10 p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Start Trading?</h2>
          <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of traders who trust Canton OTC for their cryptocurrency needs. 
            Experience the difference of professional OTC trading.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/"
              className="px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              Start Trading Now
            </Link>
            <Link 
              href="/faq"
              className="px-8 py-4 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all border border-white/20"
            >
              Learn More
            </Link>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
