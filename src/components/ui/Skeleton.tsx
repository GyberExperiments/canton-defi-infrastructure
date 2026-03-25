'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse'
}) => {
  const baseClasses = 'bg-white/10 rounded';
  
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg'
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: ''
  };

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={{
        width: width || (variant === 'text' ? '100%' : undefined),
        height: height || (variant === 'text' ? '1rem' : undefined)
      }}
    />
  );
};

// Predefined skeleton components
export const ProductCardSkeleton: React.FC = () => (
  <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10">
    <div className="flex items-start justify-between mb-4">
      <Skeleton variant="circular" width={64} height={64} />
      <Skeleton variant="rectangular" width={80} height={24} />
    </div>
    <Skeleton variant="text" width="60%" height={28} className="mb-2" />
    <Skeleton variant="text" width="100%" height={16} className="mb-1" />
    <Skeleton variant="text" width="80%" height={16} className="mb-4" />
    <div className="grid grid-cols-2 gap-4 mb-4">
      <Skeleton variant="rectangular" width="100%" height={48} />
      <Skeleton variant="rectangular" width="100%" height={48} />
    </div>
    <Skeleton variant="rectangular" width="100%" height={44} />
  </div>
);

export const StatsSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {[1, 2, 3].map((i) => (
      <div
        key={i}
        className="bg-gradient-to-br from-white/5 to-white/2 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
      >
        <Skeleton variant="circular" width={32} height={32} className="mb-3" />
        <Skeleton variant="text" width="40%" height={32} className="mb-2" />
        <Skeleton variant="text" width="60%" height={16} />
      </div>
    ))}
  </div>
);
