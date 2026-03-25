'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { MessageCircle, HelpCircle, Phone } from 'lucide-react'
// import { intercomUtils } from './IntercomProvider' // Disabled for SSR compatibility

interface SupportButtonProps {
  className?: string
  variant?: 'floating' | 'inline'
  showText?: boolean
}

export default function SupportButton({ 
  className = '', 
  variant = 'floating',
  showText = true 
}: SupportButtonProps) {
  const handleSupportClick = () => {
    // Track support interaction with retry mechanism
    const trackEventWithRetry = () => {
      console.log('Support button clicked', { variant })
    }
    
    const showMessengerWithRetry = () => {
      // Try to use Intercom if available
      if (typeof window !== 'undefined' && window.Intercom) {
        try {
          window.Intercom('show')
          console.log('✅ Intercom messenger shown')
        } catch (error) {
          console.error('❌ Failed to show Intercom:', error)
          // Fallback: show contact information
          showContactFallback()
        }
      } else {
        console.log('Intercom not available, showing fallback')
        showContactFallback()
      }
    }
    
    const showContactFallback = () => {
      const contactInfo = `Contact Support\n\nEmail: support@canton-otc.com\nTelegram: @canton_otc_support\n\nPlease describe your issue and we'll help you as soon as possible.`
      
      if (navigator.clipboard) {
        navigator.clipboard.writeText(contactInfo)
        alert('Contact information copied to clipboard!')
      } else {
        alert(contactInfo)
      }
    }
    
    trackEventWithRetry()
    showMessengerWithRetry()
  }

  if (variant === 'inline') {
    return (
      <motion.button
        onClick={handleSupportClick}
        className={`inline-flex items-center gap-3 px-6 py-3 rounded-xl backdrop-blur-xl transition-all duration-300 hover:scale-105 ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(6, 182, 212, 0.2))',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2)',
        }}
        whileHover={{ 
          scale: 1.05,
          boxShadow: '0 12px 40px rgba(59, 130, 246, 0.3)'
        }}
        whileTap={{ scale: 0.95 }}
      >
        <MessageCircle className="w-5 h-5 text-blue-400" />
        {showText && (
          <span className="text-blue-300 font-medium">
            Need Help? Chat with Support
          </span>
        )}
      </motion.button>
    )
  }

  return (
    <motion.div
      className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 ${className}`}
      initial={{ opacity: 0, scale: 0, y: 100 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 2, type: "spring", stiffness: 200 }}
    >
      {/* Support Button */}
      <motion.button
        onClick={handleSupportClick}
        className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full backdrop-blur-xl flex items-center justify-center cursor-pointer touch-manipulation"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(6, 182, 212, 0.9))',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.4)',
        }}
        whileHover={{ 
          scale: 1.1,
          boxShadow: '0 12px 40px rgba(59, 130, 246, 0.6)'
        }}
        whileTap={{ scale: 0.95 }}
        animate={{
          boxShadow: [
            '0 8px 32px rgba(59, 130, 246, 0.4)',
            '0 12px 40px rgba(59, 130, 246, 0.6)',
            '0 8px 32px rgba(59, 130, 246, 0.4)'
          ]
        }}
        transition={{
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }
        }}
      >
        {/* Icon */}
        <motion.div
          className="relative z-10"
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <MessageCircle className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
        </motion.div>

        {/* Pulse effect */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(6, 182, 212, 0.3))',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.7, 0, 0.7]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />

        {/* Tooltip */}
        <motion.div
          className="absolute right-full mr-4 top-1/2 -translate-y-1/2 px-4 py-2 rounded-xl backdrop-blur-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            background: 'rgba(0, 0, 0, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}
          initial={{ x: 10, opacity: 0 }}
          whileHover={{ x: 0, opacity: 1 }}
        >
          <span className="text-white text-sm font-medium">
            Need Help? Chat with Support
          </span>
          <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-l-4 border-l-black border-t-4 border-t-transparent border-b-4 border-b-transparent" />
        </motion.div>
      </motion.button>

      {/* Additional support options */}
      <motion.div
        className="absolute bottom-20 right-0 space-y-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        initial={{ opacity: 0, y: 20 }}
        whileHover={{ opacity: 1, y: 0 }}
      >
        {/* Quick help button */}
        <motion.button
          onClick={() => {
            // Disabled for SSR compatibility
            console.log('Quick help requested')
          }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-xl text-sm"
          style={{
            background: 'rgba(16, 185, 129, 0.2)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <HelpCircle className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300">Quick Help</span>
        </motion.button>

        {/* Contact button */}
        <motion.button
          onClick={() => {
            // Disabled for SSR compatibility
            console.log('Contact support requested')
          }}
          className="flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-xl text-sm"
          style={{
            background: 'rgba(139, 92, 246, 0.2)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Phone className="w-4 h-4 text-violet-400" />
          <span className="text-violet-300">Contact</span>
        </motion.button>
      </motion.div>
    </motion.div>
  )
}


