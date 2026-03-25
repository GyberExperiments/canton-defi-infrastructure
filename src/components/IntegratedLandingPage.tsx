"use client";

import React from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  Shield,
  Zap,
  Globe,
  Lock,
  TrendingUp,
  CheckCircle,
} from "lucide-react";
import ExchangeFormCompact from "@/components/ExchangeFormCompact";
import CantonLedgerStatus from "@/components/CantonLedgerStatus";
import BlogLink from "@/components/BlogLink";
import { TokenConfig } from "@/config/otc";
import { useAnimationConfig } from "@/hooks/useIsMobile";

interface ExchangeData {
  paymentToken: TokenConfig;
  paymentAmount: number;
  paymentAmountUSD: number;
  cantonAmount: number;
  usdtAmount: number;
  exchangeDirection?: "buy" | "sell";
  isPrivateDeal?: boolean; // ✅ Приватная сделка
  isMarketPrice?: boolean; // REQ-002: Сделка по рыночной цене
  serviceCommission?: number; // REQ-006: Комиссия сервиса в %
}

interface IntegratedLandingPageProps {
  onExchangeSubmit: (data: ExchangeData) => void;
}

/**
 * Ultra Modern 2025 Integrated Landing Page
 * Combines SEO content with ExchangeForm in a harmonious design
 * MOBILE OPTIMIZED: Reduced animations and effects for better performance
 */
export default function IntegratedLandingPage({
  onExchangeSubmit,
}: IntegratedLandingPageProps) {
  const {
    isMobile,
    shouldReduceAnimations,
    showDecorativeEffects,
    animationDuration,
  } = useAnimationConfig();

  return (
    <div className="relative min-h-screen">
      {/* Aurora Mesh Background - Mobile Optimized */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-slate-950" />

        {/* Оптимизированные mesh gradients - упрощены для мобильных */}
        <motion.div
          className="absolute top-10 left-15 rounded-full opacity-40"
          style={{
            width: isMobile ? "400px" : "800px",
            height: isMobile ? "400px" : "800px",
            background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)",
            filter: isMobile ? "blur(40px)" : "blur(80px)",
          }}
          animate={
            shouldReduceAnimations
              ? {}
              : {
                  x: [0, 30, -15, 0],
                  y: [0, -30, 20, 0],
                  scale: [1, 1.1, 0.9, 1],
                }
          }
          transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
        />

        <motion.div
          className="absolute bottom-20 right-10 rounded-full opacity-40"
          style={{
            width: isMobile ? "350px" : "700px",
            height: isMobile ? "350px" : "700px",
            background: "radial-gradient(circle, #06B6D4 0%, transparent 70%)",
            filter: isMobile ? "blur(40px)" : "blur(80px)",
          }}
          animate={
            shouldReduceAnimations
              ? {}
              : {
                  x: [0, -20, 15, 0],
                  y: [0, 20, -30, 0],
                  scale: [1, 0.9, 1.2, 1],
                }
          }
          transition={{
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />

        {/* Третий gradient только на десктопе для экономии производительности */}
        {!isMobile && (
          <motion.div
            className="absolute top-1/2 left-1/2 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
            style={{
              background:
                "radial-gradient(circle, #3B82F6 0%, transparent 70%)",
              filter: "blur(60px)",
              transform: "translate(-50%, -50%)",
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.4, 0.3],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <motion.section
          className="text-center py-20 px-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* ✨ Ultra Modern 2025 Logo - Mobile Optimized */}
          <motion.div
            className="inline-flex items-center gap-4 md:gap-6 mb-12 md:mb-16"
            initial={{ scale: 0, rotate: shouldReduceAnimations ? 0 : -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              delay: shouldReduceAnimations ? 0.1 : 0.3,
              type: "spring",
              stiffness: shouldReduceAnimations ? 300 : 200,
              damping: 20,
            }}
          >
            <div className="relative group">
              {/* Упрощенные glow layers для мобильных */}
              {showDecorativeEffects && (
                <>
                  <motion.div
                    className="absolute inset-0 rounded-full bg-black/50 scale-150"
                    style={{
                      filter: isMobile ? "blur(40px)" : "blur(80px)",
                    }}
                    animate={{
                      scale: [1.5, 1.6, 1.5],
                      opacity: [0.5, 0.6, 0.5],
                    }}
                    transition={{
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  <motion.div
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-900/40 via-blue-900/30 to-cyan-900/20 scale-125"
                    style={{
                      filter: isMobile ? "blur(30px)" : "blur(60px)",
                    }}
                    animate={
                      shouldReduceAnimations
                        ? {}
                        : {
                            scale: [1.25, 1.3, 1.25],
                            rotate: [0, 180, 360],
                          }
                    }
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                </>
              )}

              {/* Neon circle - только на десктопе */}
              {!isMobile && (
                <motion.div
                  className="absolute inset-0 rounded-full scale-110"
                  style={{
                    background:
                      "conic-gradient(from 0deg at 50% 50%, #8B5CF6 0deg, #3B82F6 120deg, #06B6D4 240deg, #8B5CF6 360deg)",
                    filter: "blur(30px)",
                    opacity: 0.25,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 20,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}

              {/* Dark glass container */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/90 via-gray-900/80 to-black/90 backdrop-blur-xl shadow-[0_0_60px_rgba(0,0,0,0.6)] md:shadow-[0_0_100px_rgba(0,0,0,0.8)]" />

              {/* Logo - Адаптивные размеры для мобильных */}
              <div className="relative w-44 h-44 sm:w-56 sm:h-56 md:w-72 md:h-72 lg:w-80 lg:h-80 z-10 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)] md:drop-shadow-[0_0_50px_rgba(139,92,246,0.4)]">
                <Image
                  src="/1otc-logo-premium.svg"
                  alt="1OTC Logo"
                  fill
                  sizes="(max-width: 640px) 176px, (max-width: 768px) 224px, (max-width: 1024px) 288px, 320px"
                  className="object-contain"
                  priority
                />
              </div>

              {/* Floating particles - только на десктопе */}
              {showDecorativeEffects && !isMobile && (
                <>
                  <motion.div
                    className="absolute -top-4 -right-4 w-6 h-6 rounded-full bg-violet-500/30 blur-lg"
                    animate={{
                      y: [-20, 20, -20],
                      x: [10, -10, 10],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                  <motion.div
                    className="absolute -bottom-6 -left-6 w-8 h-8 rounded-full bg-blue-500/30 blur-lg"
                    animate={{
                      y: [20, -20, 20],
                      x: [-10, 10, -10],
                      opacity: [0.3, 0.6, 0.3],
                    }}
                    transition={{
                      duration: 6,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: 0.5,
                    }}
                  />
                </>
              )}
            </div>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-8xl font-black mb-4 md:mb-6 leading-[1.2] pb-[0.25em] overflow-visible"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceAnimations ? 0.2 : 0.4,
              duration: animationDuration,
            }}
          >
            <span
              className={`inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent ${!shouldReduceAnimations && "animate-gradient-x animate-neon-pulse"}`}
            >
              Canton
            </span>
            <br />
            <span className="inline-block bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent pb-[0.05em] align-baseline descender-safe">
              OTC Exchange
            </span>
          </motion.h1>

          <motion.p
            className="text-lg sm:text-xl md:text-2xl text-white/70 font-medium mb-8 md:mb-12 leading-relaxed max-w-3xl mx-auto px-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: shouldReduceAnimations ? 0.3 : 0.6,
              duration: animationDuration,
            }}
          >
            Don&apos;t hit the cup, trade 1OTC
          </motion.p>
        </motion.section>

        {/* Blog Link Banner - Between Hero and How to Buy */}
        <motion.section
          className="py-8 px-4 md:px-6"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
        >
          <div className="max-w-5xl mx-auto">
            <BlogLink />
          </div>
        </motion.section>

        {/* How It Works Section */}
        <motion.section
          className="py-16 px-4 md:px-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-5xl mx-auto">
            <motion.div
              className="text-center mb-12"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                  How to Buy Canton Coin
                </span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-4 gap-8">
              {[
                {
                  step: 1,
                  title: "Select USDT Network",
                  desc: "Choose USDT on Ethereum, TRON, Solana, or Optimism",
                  gradient: "from-blue-500 to-cyan-500",
                },
                {
                  step: 2,
                  title: "Enter Amount",
                  desc: "Specify how much Canton Coin you want to buy",
                  gradient: "from-green-500 to-emerald-500",
                },
                {
                  step: 3,
                  title: "Provide Details",
                  desc: "Enter your Canton wallet address and contact info",
                  gradient: "from-purple-500 to-pink-500",
                },
                {
                  step: 4,
                  title: "Receive Canton",
                  desc: "Get your Canton Coin instantly after payment",
                  gradient: "from-orange-500 to-red-500",
                },
              ].map((item, index) => (
                <motion.div
                  key={index}
                  className="text-center group"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  viewport={{ once: true }}
                >
                  <motion.div
                    className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${item.gradient} flex items-center justify-center mx-auto mb-6 text-3xl font-bold text-white shadow-2xl group-hover:scale-110 transition-transform duration-300`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    {item.step}
                  </motion.div>
                  <h3 className="text-xl font-bold text-white mb-4">
                    {item.title}
                  </h3>
                  <p className="text-white/60 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* Exchange Widget - Central Element */}
        <motion.section
          className="py-20 px-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              {/* Canton Ledger Status Widget */}
              <motion.div
                className="flex justify-center mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25, type: "spring" }}
                viewport={{ once: true }}
              >
                <CantonLedgerStatus />
              </motion.div>

              <motion.div
                className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 border border-emerald-500/20 backdrop-blur-xl mb-8"
                initial={{ scale: 0.8, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, type: "spring" }}
                viewport={{ once: true }}
              >
                <div className="w-2 h-2 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full animate-pulse"></div>
                <span className="text-emerald-300 font-medium">
                  Available 8:00 AM - 10:00 PM (GMT+8)
                </span>
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                  Ready to Buy Canton Coin?
                </span>
              </h2>
              <p className="text-xl text-white/70 mb-12 max-w-2xl mx-auto">
                Start your Canton Coin purchase now. Fast, secure, and
                transparent OTC exchange.
              </p>
            </motion.div>

            {/* Exchange Form Container */}
            <motion.div
              className="relative group max-w-3xl mx-auto"
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              viewport={{ once: true }}
            >
              {/* Multi-layer glow effect */}
              <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/30 via-cyan-600/30 to-purple-600/30 rounded-[2rem] blur-xl group-hover:blur-2xl transition-all duration-500" />
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-cyan-500/20 to-purple-500/20 rounded-[1.5rem] blur-lg group-hover:blur-xl transition-all duration-500" />

              {/* Main widget container with prismatic glass - адаптивный padding */}
              <div className="relative glass-prismatic rounded-xl md:rounded-2xl p-4 sm:p-5 md:p-8 lg:p-10 overflow-hidden">
                {/* Animated mesh background */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10 animate-mesh-flow"></div>
                </div>

                {/* Floating holographic particles - только на десктопе */}
                {showDecorativeEffects && !isMobile && (
                  <div className="absolute inset-0 overflow-hidden rounded-[1.5rem]">
                    <motion.div
                      className="absolute top-6 left-6 w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-60"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.6, 1, 0.6],
                        y: [0, -10, 0],
                      }}
                      transition={{ duration: 3, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="absolute top-12 right-8 w-2 h-2 bg-gradient-to-r from-cyan-400 to-purple-400 rounded-full opacity-40"
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.4, 0.8, 0.4],
                        x: [0, 10, 0],
                      }}
                      transition={{ duration: 4, repeat: Infinity, delay: 1 }}
                    />
                    <motion.div
                      className="absolute bottom-8 left-12 w-2.5 h-2.5 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-50"
                      animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5],
                        y: [0, -8, 0],
                      }}
                      transition={{ duration: 5, repeat: Infinity, delay: 2 }}
                    />
                    <motion.div
                      className="absolute bottom-6 right-6 w-1.5 h-1.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-60"
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.6, 1, 0.6],
                        x: [0, -8, 0],
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Infinity,
                        delay: 1.5,
                      }}
                    />
                  </div>
                )}

                {/* Exchange Form */}
                <div className="relative z-10">
                  <ExchangeFormCompact onProceed={onExchangeSubmit} />
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* Benefits Section */}
        <motion.section
          className="py-20 px-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-6xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                  Canton OTC Trading Benefits
                </span>
              </h2>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  icon: CheckCircle,
                  text: "No registration required - Start trading immediately",
                },
                {
                  icon: Lock,
                  text: "Non-custodial exchange - You always control your funds",
                },
                {
                  icon: TrendingUp,
                  text: "Best market rates - Always competitive pricing",
                },
                {
                  icon: Zap,
                  text: "Available 8:00 AM - 10:00 PM (GMT+8) - Trade Canton during business hours",
                },
                {
                  icon: Shield,
                  text: "KYC-free for small amounts - Privacy first approach",
                },
                {
                  icon: Globe,
                  text: "Global access - Available worldwide without restrictions",
                },
              ].map((benefit, index) => (
                <motion.div
                  key={index}
                  className="flex items-start gap-6 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl group hover:bg-white/10 transition-all duration-300"
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <benefit.icon className="w-6 h-6 text-green-400" />
                  </div>
                  <p className="text-white/80 text-lg leading-relaxed">
                    {benefit.text}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* About Section */}
        <motion.section
          className="py-20 px-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                  About Canton OTC Exchange
                </span>
              </h2>
            </motion.div>

            <motion.div
              className="space-y-8 text-white/70 leading-relaxed text-lg"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              viewport={{ once: true }}
            >
              <p>
                <strong className="text-white">Canton OTC Exchange</strong> is a
                professional over-the-counter cryptocurrency trading platform
                specializing in Canton Coin transactions. Our platform enables
                users to buy Canton Coin with USDT across multiple blockchain
                networks including Ethereum (ERC-20), TRON (TRC-20), Solana, and
                Optimism.
              </p>

              <div className="grid md:grid-cols-2 gap-8 mt-12">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    What is Canton Coin?
                  </h3>
                  <p>
                    Canton Coin is the native cryptocurrency of the Canton
                    Network, a cutting-edge blockchain platform designed for
                    decentralized finance (DeFi) applications. With a fixed
                    reference price, Canton Coin offers stable value and
                    excellent opportunities for investors and traders looking to
                    participate in the Canton ecosystem.
                  </p>
                </div>

                <div>
                  <h3 className="text-2xl font-bold text-white mb-4">
                    Why Buy Canton Coin?
                  </h3>
                  <ul className="list-disc list-inside space-y-2">
                    <li>Access to Canton Network DeFi ecosystem</li>
                    <li>Stable pricing with growth potential</li>
                    <li>Multi-network interoperability</li>
                    <li>Low transaction fees</li>
                    <li>Growing community and development team</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* FAQ Section */}
        <motion.section
          className="py-20 px-6"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <div className="max-w-4xl mx-auto">
            <motion.div
              className="text-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              viewport={{ once: true }}
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
                  Frequently Asked Questions
                </span>
              </h2>
            </motion.div>

            <div className="space-y-6">
              {[
                {
                  question: "How long does it take to receive Canton Coin?",
                  answer:
                    "Orders are typically processed within 2-4 hours during business hours (8:00 AM - 10:00 PM GMT+8). You'll receive email and Telegram notifications about your order status.",
                },
                {
                  question: "What is the minimum order amount?",
                  answer:
                    "The minimum order is $1000 USD equivalent in USDT on any supported network.",
                },
                {
                  question: "Do I need to register an account?",
                  answer:
                    "No registration required! Simply enter your Canton wallet address, email, and payment details to start trading.",
                },
                {
                  question: "What networks are supported?",
                  answer:
                    "We support USDT on Ethereum (ERC-20), TRON (TRC-20), Solana, and Optimism networks.",
                },
                {
                  question: "Is Canton OTC Exchange safe?",
                  answer:
                    "Yes! We implement enterprise-grade security including rate limiting, spam detection, and secure address validation. We never hold your funds - it's a true OTC exchange.",
                },
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  className="p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl group hover:bg-white/10 transition-all duration-300"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.01 }}
                >
                  <h3 className="text-xl font-bold text-white mb-4 group-hover:text-blue-300 transition-colors duration-300">
                    {faq.question}
                  </h3>
                  <p className="text-white/70 leading-relaxed">{faq.answer}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
