'use client';

import React from 'react';
import Image from 'next/image';

interface AnimatedLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-24 h-24',
  md: 'w-32 h-32', 
  lg: 'w-48 h-48',
  xl: 'w-64 h-64',
  '2xl': 'w-80 h-80',
  '3xl': 'w-96 h-96'
};

export default function AnimatedLogo({ 
  size = 'lg', 
  className = '' 
}: AnimatedLogoProps) {
  const logoSource = '/1otc-logo-premium.svg';
  
  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* Dark ultra-modern glow effects */}
      <div className="absolute inset-0 rounded-full bg-black/40 blur-3xl scale-150" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-900/30 via-blue-900/20 to-black/50 blur-2xl scale-125 animate-pulse" />
      
      {/* Neon ring effect */}
      <div className="absolute inset-0 rounded-full" 
        style={{
          background: 'conic-gradient(from 0deg at 50% 50%, #8B5CF6 0deg, #3B82F6 90deg, #06B6D4 180deg, #8B5CF6 360deg)',
          filter: 'blur(20px)',
          opacity: 0.3,
          animation: 'spin 10s linear infinite'
        }} 
      />
      
      {/* Dark gradient container */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/80 via-gray-900/60 to-black/80 backdrop-blur-sm" />
      
      {/* Logo with subtle glow */}
      <div className="relative w-full h-full z-10 drop-shadow-[0_0_30px_rgba(139,92,246,0.3)]">
        <Image 
          src={logoSource} 
          alt="1OTC Logo" 
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-contain"
          priority
        />
      </div>
      
      {/* Floating orbs */}
      <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-violet-500/20 blur-md animate-float-1" />
      <div className="absolute -bottom-3 -left-3 w-5 h-5 rounded-full bg-blue-500/20 blur-md animate-float-2" />
    </div>
  );
}
