'use client';

import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';

// Loading component
function DeFiLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/50 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl text-white font-medium mb-2">Loading Canton DeFi</h2>
        <p className="text-white/60">Initializing institutional-grade protocols...</p>
      </div>
    </div>
  );
}

// Dynamic import - prevents SSR issues with wagmi
const CantonDeFi = dynamicImport(
  () => import('@/components/defi/CantonDeFi'),
  { 
    ssr: false,
    loading: () => <DeFiLoadingSkeleton />
  }
);

export default function DeFiPage() {
  return (
    <Suspense fallback={<DeFiLoadingSkeleton />}>
      <CantonDeFi />
    </Suspense>
  );
}
