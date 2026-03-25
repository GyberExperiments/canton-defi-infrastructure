'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { 
  CreditCard, 
  Calculator, 
  Wallet, 
  Send, 
  CheckCircle, 
  ArrowRight,
  Shield,
  Clock,
  HelpCircle,
  Play,
  ChevronRight
} from 'lucide-react'

const steps = [
  {
    id: 'step1',
    number: '01',
    title: 'Select Payment Currency',
    description: 'Choose from USDT, ETH, or BNB as your payment method',
    icon: CreditCard,
    details: [
      'USDT supported on TRC-20, ERC-20, and BEP-20 networks',
      'Direct ETH payments on Ethereum mainnet',
      'BNB payments on Binance Smart Chain',
      'Automatic network detection for optimal fees'
    ],
    tips: 'Pro tip: USDT on TRC-20 usually has the lowest fees',
    estimatedTime: '30 seconds'
  },
  {
    id: 'step2',
    number: '02',
    title: 'Enter Exchange Amount',
    description: 'Specify how much Canton Coin you want to buy',
    icon: Calculator,
    details: [
      'Real-time price calculation',
      'No hidden fees - what you see is what you get',
      'Minimum order: $50 USD',
      'Volume discounts for orders over $50,000'
    ],
    tips: 'The exchange rate is locked for 10 minutes after calculation',
    estimatedTime: '1 minute'
  },
  {
    id: 'step3',
    number: '03',
    title: 'Provide Wallet Address',
    description: 'Enter your Canton Coin receiving address',
    icon: Wallet,
    details: [
      'Double-check your wallet address',
      'Support for all Canton-compatible wallets',
      'Address validation to prevent errors',
      'Option to save address for future trades'
    ],
    tips: 'Always send a test transaction first for large amounts',
    estimatedTime: '1 minute'
  },
  {
    id: 'step4',
    number: '04',
    title: 'Send Payment',
    description: 'Transfer funds to our secure smart contract',
    icon: Send,
    details: [
      'Copy the exact payment amount',
      'Send to the provided smart contract address',
      'Include the correct memo/tag if required',
      'Transaction tracked automatically'
    ],
    tips: 'Set appropriate gas fees for faster confirmation',
    estimatedTime: '2-5 minutes'
  },
  {
    id: 'step5',
    number: '05',
    title: 'Receive Canton Coins',
    description: 'Canton automatically sent to your wallet',
    icon: CheckCircle,
    details: [
      'Instant delivery after confirmation',
      'Email notification when complete',
      'Transaction ID for tracking',
      'Support available if needed'
    ],
    tips: 'Add Canton token to your wallet to see balance',
    estimatedTime: '1-3 minutes'
  }
]

const videoTutorials = [
  {
    title: 'Complete Walkthrough',
    duration: '5:32',
    thumbnail: '/video-thumb-1.png',
    views: '15.2K'
  },
  {
    title: 'Mobile App Guide',
    duration: '3:45',
    thumbnail: '/video-thumb-2.png',
    views: '8.7K'
  },
  {
    title: 'Wallet Setup Tutorial',
    duration: '4:18',
    thumbnail: '/video-thumb-3.png',
    views: '12.1K'
  }
]

export default function HowItWorksContent() {
  const [activeStep, setActiveStep] = useState(0)

  return (
    <div className="min-h-screen py-12">
      {/* Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="container mx-auto px-4 mb-16"
      >
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            How to Buy Canton Coin
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Purchase Canton Coin in 5 simple steps. Average completion time: 10-15 minutes.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Shield className="w-4 h-4 text-green-400" />
              <span className="text-sm">Secure Process</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm">10-15 Minutes</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span className="text-sm">24/7 Support</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Interactive Steps */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="container mx-auto px-4 mb-16"
      >
        <div className="max-w-6xl mx-auto">
          {/* Step Navigation */}
          <div className="flex justify-between mb-12 relative">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-white/10" />
            <div 
              className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-500"
              style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
            />
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setActiveStep(index)}
                className={`relative z-10 flex flex-col items-center gap-2 transition-all ${
                  index <= activeStep ? 'text-white' : 'text-gray-500'
                }`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all ${
                  index <= activeStep 
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                    : 'bg-white/5 border border-white/10'
                }`}>
                  {index < activeStep ? <CheckCircle className="w-6 h-6" /> : step.number}
                </div>
                <span className="text-xs font-medium hidden md:block">{step.title}</span>
              </button>
            ))}
          </div>

          {/* Step Content */}
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Left: Step Details */}
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-xl">
                    {React.createElement(steps[activeStep].icon, { className: "w-8 h-8 text-purple-400" })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{steps[activeStep].title}</h2>
                    <p className="text-gray-300">{steps[activeStep].description}</p>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  {steps[activeStep].details.map((detail, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <ChevronRight className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-300">{detail}</span>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-sm text-blue-400 font-medium mb-1">💡 {steps[activeStep].tips}</p>
                </div>

                <div className="flex items-center justify-between mt-6 pt-6 border-t border-white/10">
                  <span className="text-sm text-gray-400">Estimated time:</span>
                  <span className="text-sm font-medium text-purple-400">{steps[activeStep].estimatedTime}</span>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
                  disabled={activeStep === 0}
                  className="px-6 py-3 bg-white/5 text-white rounded-xl font-medium hover:bg-white/10 transition-all border border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setActiveStep(Math.min(steps.length - 1, activeStep + 1))}
                  disabled={activeStep === steps.length - 1}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  Next Step
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>

            {/* Right: Visual Demo */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="lg:sticky lg:top-24 h-fit"
            >
              <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 mb-6">
                <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-xl flex items-center justify-center mb-4">
                  <Play className="w-16 h-16 text-white/50" />
                </div>
                <h3 className="text-lg font-bold mb-2">Visual Guide</h3>
                <p className="text-gray-400 text-sm">
                  Watch our step-by-step video tutorial for a complete walkthrough of the buying process.
                </p>
              </div>

              {/* Quick Start */}
              <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
                <h3 className="text-lg font-bold mb-4">Ready to start?</h3>
                <Link
                  href="/"
                  className="block w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all text-center"
                >
                  Buy Canton Coin Now
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Video Tutorials */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="container mx-auto px-4 mb-16"
      >
        <h2 className="text-3xl font-bold text-center mb-8">Video Tutorials</h2>
        <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          {videoTutorials.map((video, index) => (
            <motion.div
              key={video.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden hover:border-purple-500/30 transition-all cursor-pointer"
            >
              <div className="aspect-video bg-gradient-to-br from-blue-500/20 to-purple-600/20 relative">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur">
                    <Play className="w-6 h-6 text-white ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-xs">
                  {video.duration}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium mb-1">{video.title}</h3>
                <p className="text-sm text-gray-400">{video.views} views</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FAQ CTA */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="container mx-auto px-4"
      >
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 text-center max-w-2xl mx-auto">
          <HelpCircle className="w-12 h-12 mx-auto mb-4 text-purple-400" />
          <h3 className="text-2xl font-bold mb-4">Still have questions?</h3>
          <p className="text-gray-300 mb-6">
            Check out our comprehensive FAQ or contact our support team for personalized assistance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/faq"
              className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all border border-white/20"
            >
              View FAQ
            </a>
            <button
              onClick={() => {
                const intercom = (window as Window & typeof globalThis & { Intercom?: (action: string) => void }).Intercom;
                if (intercom) intercom('show');
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
            >
              Contact Support
            </button>
          </div>
        </div>
      </motion.section>
    </div>
  )
}
