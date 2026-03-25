'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, HelpCircle, Shield, Clock, CreditCard, Globe, Zap, Lock, Users } from 'lucide-react'

interface FAQItem {
  id: string
  question: string
  answer: string
  category: string
  icon: React.ReactNode
}

const faqData: FAQItem[] = [
  // General Questions
  {
    id: '1',
    question: 'What is Canton Coin?',
    answer: 'Canton Coin is the native cryptocurrency of the Canton Network, designed for decentralized finance (DeFi) applications. It powers transactions, governance, and staking within the Canton ecosystem, offering fast, secure, and low-cost transfers across multiple blockchain networks.',
    category: 'General',
    icon: <HelpCircle className="w-5 h-5" />
  },
  {
    id: '2',
    question: 'What makes Canton OTC different from other exchanges?',
    answer: 'Canton OTC specializes in over-the-counter trading with instant settlements, no KYC for transactions under $10,000, multi-network support, competitive rates, and 24/7 automated processing. We focus exclusively on Canton Coin, ensuring deep liquidity and the best prices.',
    category: 'General',
    icon: <Zap className="w-5 h-5" />
  },
  
  // Trading Questions
  {
    id: '3',
    question: 'How do I buy Canton Coin on Canton OTC?',
    answer: 'Simply follow these steps: 1) Select your payment currency (USDT, ETH, or BNB), 2) Enter the amount you want to exchange, 3) Provide your Canton wallet address, 4) Send the payment to our smart contract address, 5) Receive your Canton Coins instantly after confirmation.',
    category: 'Trading',
    icon: <CreditCard className="w-5 h-5" />
  },
  {
    id: '4',
    question: 'What payment methods are accepted?',
    answer: 'We accept USDT (on TRC-20, ERC-20, and BEP-20 networks), Ethereum (ETH), and Binance Coin (BNB). All payments are processed through secure smart contracts with automatic conversion to Canton Coin.',
    category: 'Trading',
    icon: <CreditCard className="w-5 h-5" />
  },
  {
    id: '5',
    question: 'What is the minimum and maximum purchase amount?',
    answer: 'The minimum purchase is $50 USD equivalent in your chosen payment currency. There is no maximum limit for OTC transactions, but orders over $10,000 may require basic KYC verification for security and compliance.',
    category: 'Trading',
    icon: <CreditCard className="w-5 h-5" />
  },
  
  // Security Questions
  {
    id: '6',
    question: 'Is Canton OTC exchange safe?',
    answer: 'Yes, Canton OTC prioritizes security with: SSL encryption for all data, smart contract automation (no human intervention), no storage of private keys, transparent blockchain transactions, regular security audits, and multi-signature wallets for fund management.',
    category: 'Security',
    icon: <Shield className="w-5 h-5" />
  },
  {
    id: '7',
    question: 'Do I need KYC verification?',
    answer: 'No KYC is required for transactions under $10,000 USD. For larger transactions, we may request basic verification (email and phone) to comply with regulations and prevent fraud. We never ask for sensitive documents like passports or IDs.',
    category: 'Security',
    icon: <Lock className="w-5 h-5" />
  },
  {
    id: '8',
    question: 'How are my funds protected?',
    answer: 'Funds are protected through: Smart contract escrow (funds released only when conditions are met), Multi-signature wallets requiring multiple approvals, Cold storage for majority of reserves, Regular third-party security audits, Insurance fund for unexpected events.',
    category: 'Security',
    icon: <Shield className="w-5 h-5" />
  },
  
  // Technical Questions
  {
    id: '9',
    question: 'How long does the transaction take?',
    answer: 'Transaction times depend on the network: TRON (TRC-20): 1-3 minutes, Ethereum (ERC-20): 5-15 minutes, BSC (BEP-20): 1-5 minutes, Solana: 1-2 minutes, Optimism: 1-3 minutes. Canton Coins are sent immediately after payment confirmation.',
    category: 'Technical',
    icon: <Clock className="w-5 h-5" />
  },
  {
    id: '10',
    question: 'What networks does Canton Coin support?',
    answer: 'Canton Coin is multi-chain and supports: Ethereum (ERC-20) for DeFi integration, Binance Smart Chain (BEP-20) for low fees, TRON (TRC-20) for fast transfers, Solana for ultra-fast transactions, Optimism for Layer 2 scaling.',
    category: 'Technical',
    icon: <Globe className="w-5 h-5" />
  },
  {
    id: '11',
    question: 'Can I track my transaction?',
    answer: 'Yes! After placing an order, you receive a transaction ID and can track your payment on the respective blockchain explorer. We also provide real-time status updates and email notifications for each step of the process.',
    category: 'Technical',
    icon: <Zap className="w-5 h-5" />
  },
  
  // Support Questions
  {
    id: '12',
    question: 'How can I contact support?',
    answer: 'Our support team is available 24/7 through: Live chat (bottom right corner), Email: support@canton-otc.com, Telegram: @canton_otc_bot, Response time is typically under 5 minutes for urgent issues.',
    category: 'Support',
    icon: <Users className="w-5 h-5" />
  },
  {
    id: '13',
    question: 'What if I sent payment to the wrong address?',
    answer: 'Always double-check addresses before sending. If you sent to the wrong address: Contact support immediately with transaction details. If sent to our other contract addresses, we can recover funds. If sent to an external address, recovery may not be possible.',
    category: 'Support',
    icon: <HelpCircle className="w-5 h-5" />
  },
  {
    id: '14',
    question: 'Are there any fees?',
    answer: 'Canton OTC charges minimal fees: 0.5% trading fee (included in displayed price), No deposit or withdrawal fees, Network fees paid by users (varies by blockchain), Volume discounts available for trades over $50,000.',
    category: 'Support',
    icon: <CreditCard className="w-5 h-5" />
  }
]

const categories = ['All', 'General', 'Trading', 'Security', 'Technical', 'Support']

export default function FAQContent() {
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedItems(newExpanded)
  }

  const filteredFAQs = faqData.filter(item => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory
    const matchesSearch = !searchQuery || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  return (
    <div className="min-h-screen py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-300 text-lg">
            Everything you need to know about Canton OTC Exchange
          </p>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <div className="relative">
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-all"
            />
            <HelpCircle className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          </div>
        </motion.div>

        {/* Category Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap gap-3 mb-8 justify-center"
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-6 py-2 rounded-full font-medium transition-all ${
                selectedCategory === category
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
              }`}
            >
              {category}
            </button>
          ))}
        </motion.div>

        {/* FAQ Items */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          {filteredFAQs.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <HelpCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No questions found matching your search.</p>
            </div>
          ) : (
            <AnimatePresence>
              {filteredFAQs.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden hover:border-purple-500/30 transition-all"
                >
                  <button
                    onClick={() => toggleItem(item.id)}
                    className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gradient-to-r from-blue-500/20 to-purple-600/20 rounded-lg">
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-semibold text-white">{item.question}</h3>
                    </div>
                    {expandedItems.has(item.id) ? (
                      <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  
                  <AnimatePresence>
                    {expandedItems.has(item.id) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4">
                          <div className="pl-14 text-gray-300 leading-relaxed">
                            {item.answer}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </motion.div>

        {/* Contact Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="bg-gradient-to-r from-blue-500/10 to-purple-600/10 backdrop-blur-xl rounded-2xl border border-white/10 p-8">
            <h3 className="text-2xl font-bold mb-4">Still have questions?</h3>
            <p className="text-gray-300 mb-6">
              Our support team is available 24/7 to help you with any questions or concerns.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@canton-otc.com"
                className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all"
              >
                Email Support
              </a>
              <button
                onClick={() => {
                  const intercom = (window as Window & typeof globalThis & { Intercom?: (action: string) => void }).Intercom;
                  if (intercom) intercom('show');
                }}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-all border border-white/20"
              >
                Live Chat
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
