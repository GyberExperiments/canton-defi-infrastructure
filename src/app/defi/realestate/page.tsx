'use client';

import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';

// Loading component
function RealEstateLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900/50 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl text-white font-medium mb-2">Loading Real Estate</h2>
        <p className="text-white/60">Initializing fractional real estate platform...</p>
      </div>
    </div>
  );
}

// Dynamic import - prevents SSR issues with wagmi
const RealEstatePanel = dynamicImport(
  () => import('@/components/defi/realestate/RealEstatePanel'),
  { 
    ssr: false,
    loading: () => <RealEstateLoadingSkeleton />
  }
);

export default function RealEstatePage() {
  return (
    <Suspense fallback={<RealEstateLoadingSkeleton />}>
      <RealEstatePanel />
    </Suspense>
  );
}
