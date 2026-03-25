'use client';

import dynamicImport from 'next/dynamic';
import { Suspense } from 'react';

// Loading component
function TreasuryLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900/50 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-xl text-white font-medium mb-2">Loading Treasury Bills</h2>
        <p className="text-white/60">Initializing US Treasury Bills platform...</p>
      </div>
    </div>
  );
}

// Dynamic import - prevents SSR issues with wagmi
const TreasuryBillsPanel = dynamicImport(
  () => import('@/components/defi/treasury/TreasuryBillsPanel'),
  { 
    ssr: false,
    loading: () => <TreasuryLoadingSkeleton />
  }
);

export default function TreasuryBillsPage() {
  return (
    <Suspense fallback={<TreasuryLoadingSkeleton />}>
      <TreasuryBillsPanel />
    </Suspense>
  );
}
