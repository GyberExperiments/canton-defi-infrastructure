'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Shield, Zap, Globe, Lock, TrendingUp, CheckCircle } from 'lucide-react'
import ExchangeForm from '@/components/ExchangeForm'
import { TokenConfig } from '@/config/otc'

interface ExchangeData {
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number;
  cantonAmount: number;
  usdtAmount: number;
}

interface SEOLandingContentProps {
  onExchangeSubmit: (data: ExchangeData) => void;
}

/**
 * SEO-Optimized Landing Content with integrated exchange widget
 * Properly structured with H1-H6 hierarchy and semantic HTML
 */
export default function SEOLandingContent({ onExchangeSubmit }: SEOLandingContentProps) {
  return (
    <article className="seo-content" itemScope itemType="https://schema.org/FinancialService">
      {/* Hero Section with H1 */}
      <header className="text-center mb-16">
        <motion.h1 
          className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent mb-6"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          itemProp="name"
        >
          Buy Canton Coin | Secure OTC Exchange
        </motion.h1>
        
        <motion.p 
          className="text-xl md:text-2xl text-white/80 max-w-3xl mx-auto mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          itemProp="description"
        >
          Don&apos;t hit the cup, trade 1OTC
        </motion.p>
      </header>


      {/* How It Works Section with H2 */}
      <section className="mb-16 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12" aria-labelledby="how-it-works-heading">
        <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          How to Buy Canton Coin
        </h2>
        
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
              1
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Select USDT Network</h3>
            <p className="text-white/60 text-sm">
              Choose USDT on Ethereum, TRON, Solana, or Optimism
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
              2
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Enter Amount</h3>
            <p className="text-white/60 text-sm">
              Specify how much Canton Coin you want to buy
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
              3
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Provide Details</h3>
            <p className="text-white/60 text-sm">
              Enter your Canton wallet address and contact info
            </p>
          </div>

          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">
              4
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Receive Canton</h3>
            <p className="text-white/60 text-sm">
              Get your Canton Coin instantly after payment
            </p>
          </div>
        </div>
      </section>

      {/* Benefits Section with H2 */}
      <section className="mb-16" aria-labelledby="benefits-heading">
        <h2 id="benefits-heading" className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          Canton Coin Trading Benefits
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {[
            { icon: CheckCircle, text: 'No registration required - Start trading immediately' },
            { icon: Lock, text: 'Non-custodial exchange - You always control your funds' },
            { icon: TrendingUp, text: 'Best market rates - Always competitive pricing' },
            { icon: Zap, text: 'Available 8:00 AM - 10:00 PM (GMT+8) - Trade Canton Coin during business hours' },
            { icon: Shield, text: 'KYC-free for small amounts - Privacy first approach' },
            { icon: Globe, text: 'Global access - Available worldwide without restrictions' },
          ].map((benefit, index) => (
            <motion.div 
              key={index}
              className="flex items-start gap-4 p-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 * index }}
            >
              <benefit.icon className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
              <p className="text-white/80">{benefit.text}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SEO Text Section with H2 */}
      <section className="mb-16 max-w-4xl mx-auto" aria-labelledby="about-heading">
        <h2 id="about-heading" className="text-3xl md:text-4xl font-bold text-white mb-8">
          About CC OTC Exchange
        </h2>
        
        <div className="space-y-6 text-white/70 leading-relaxed">
          <p>
            <strong className="text-white">CC OTC Exchange</strong> is a professional over-the-counter cryptocurrency trading platform specializing in CC transactions. Our platform enables users to buy/sell CC with USDT across multiple blockchain networks including Ethereum (ERC-20), TRON (TRC-20), Solana, and Optimism.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-4">What is CC?</h3>
          <p>
            CC is the native cryptocurrency of the Canton Network, a cutting-edge blockchain platform designed for decentralized finance (DeFi) applications. With a fixed reference price, CC offers stable value and excellent opportunities for investors and traders looking to participate in the Canton ecosystem.
          </p>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-4">Why Buy Canton Coin?</h3>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Access to Canton Network DeFi ecosystem</li>
            <li>Stable pricing with growth potential</li>
            <li>Multi-network interoperability</li>
            <li>Low transaction fees</li>
            <li>Growing community and development team</li>
          </ul>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-4">Supported Payment Methods</h3>
          <p>
            We accept USDT (Tether) stablecoin for Canton Coin purchases across multiple networks:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li><strong>USDT (ERC-20)</strong> - Ethereum network</li>
            <li><strong>USDT (TRC-20)</strong> - TRON network</li>
            <li><strong>USDT (Solana)</strong> - Solana network</li>
            <li><strong>USDT (Optimism)</strong> - Optimism network</li>
          </ul>
          
          <h3 className="text-2xl font-bold text-white mt-8 mb-4">Security & Trust</h3>
          <p>
            Your security is our top priority. Canton OTC Exchange implements enterprise-grade security measures including:
          </p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>Advanced rate limiting (3 orders per hour per IP)</li>
            <li>AI-powered spam detection</li>
            <li>Secure address validation for all networks</li>
            <li>Encrypted communications</li>
            <li>Real-time order tracking</li>
          </ul>
        </div>
      </section>

      {/* FAQ Section with H2 */}
      <section className="mb-16" aria-labelledby="faq-heading" itemScope itemType="https://schema.org/FAQPage">
        <h2 id="faq-heading" className="text-3xl md:text-4xl font-bold text-white text-center mb-12">
          Frequently Asked Questions
        </h2>
        
        <div className="max-w-3xl mx-auto space-y-6">
          {[
            {
              question: "How long does it take to receive CC?",
              answer: "Orders are typically processed within 2-4 hours during business hours (8:00 AM - 10:00 PM GMT+8). You'll receive email and Telegram notifications about your order status."
            },
            {
              question: "What is the minimum order amount?",
              answer: "The minimum order is $1000 USD equivalent in USDT on any supported network."
            },
            {
              question: "Do I need to register an account?",
              answer: "No registration required! Simply enter your Canton wallet address, email, and payment details to start trading."
            },
            {
              question: "What networks are supported?",
              answer: "We support USDT on Ethereum (ERC-20), TRON (TRC-20), Solana, and Optimism networks."
            },
            {
              question: "Is Canton OTC Exchange safe?",
              answer: "Yes! We implement enterprise-grade security including rate limiting, spam detection, and secure address validation. We never hold your funds - it's a true OTC exchange."
            },
          ].map((faq, index) => (
            <motion.div 
              key={index}
              className="p-6 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index }}
              itemScope
              itemProp="mainEntity"
              itemType="https://schema.org/Question"
            >
              <h3 className="text-xl font-semibold text-white mb-3" itemProp="name">
                {faq.question}
              </h3>
              <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                <p className="text-white/70" itemProp="text">
                  {faq.answer}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Exchange Widget Section - Ultra Modern 2025 Design */}
      <section className="py-20" aria-label="Exchange Widget">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <motion.div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-xl mb-8"
            initial={{ scale: 0.8, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full animate-pulse"></div>
            <span className="text-emerald-300 font-medium">Available 8:00 AM - 10:00 PM (GMT+8)</span>
          </motion.div>
          
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
              Ready to Buy Canton Coin?
            </span>
          </h2>
          <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
            Start your Canton Coin purchase now. Fast, secure, and transparent OTC exchange.
          </p>
        </motion.div>
        
        {/* Ultra Modern Exchange Widget */}
        <motion.div
          className="max-w-4xl mx-auto"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.6, 0.05, 0.01, 0.9] }}
          viewport={{ once: true }}
        >
          <div className="relative group">
            {/* Multi-layer glow effect */}
            <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/30 via-cyan-600/30 to-purple-600/30 rounded-[2rem] blur-xl group-hover:blur-2xl transition-all duration-500"></div>
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 rounded-[1.5rem] blur-lg group-hover:blur-xl transition-all duration-500"></div>
            
            {/* Main widget container with prismatic glass */}
            <div className="relative glass-prismatic rounded-[1.5rem] p-8 md:p-12 lg:p-16 overflow-hidden">
              {/* Animated mesh background */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 animate-mesh-flow"></div>
              </div>
              
              {/* Floating holographic particles */}
              <div className="absolute inset-0 overflow-hidden rounded-[1.5rem]">
                <motion.div 
                  className="absolute top-6 left-6 w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-60"
                  animate={{ 
                    scale: [1, 1.5, 1],
                    opacity: [0.6, 1, 0.6],
                    y: [0, -10, 0]
                  }}
                  transition={{ duration: 3, repeat: Infinity, delay: 0 }}
                />
                <motion.div 
                  className="absolute top-12 right-8 w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full opacity-40"
                  animate={{ 
                    scale: [1, 1.3, 1],
                    opacity: [0.4, 0.8, 0.4],
                    x: [0, 10, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                />
                <motion.div 
                  className="absolute bottom-8 left-12 w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-50"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                    y: [0, -8, 0]
                  }}
                  transition={{ duration: 5, repeat: Infinity, delay: 2 }}
                />
                <motion.div 
                  className="absolute bottom-6 right-6 w-1.5 h-1.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-60"
                  animate={{ 
                    scale: [1, 1.4, 1],
                    opacity: [0.6, 1, 0.6],
                    x: [0, -8, 0]
                  }}
                  transition={{ duration: 3.5, repeat: Infinity, delay: 1.5 }}
                />
              </div>
              
              {/* Content with enhanced styling */}
              <div className="relative z-10">
                <ExchangeForm onProceed={onExchangeSubmit} />
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </article>
  )
}



