'use client';

import React, { useState, useEffect } from 'react';
import { WagmiProvider as WagmiCoreProvider, State } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from '@/lib/canton/config/wagmi';

interface Props {
  children: React.ReactNode;
  initialState?: State;
}

export function WagmiProvider({ children, initialState }: Props) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1 minute
          refetchOnWindowFocus: false,
        },
      },
    })
  );

  // Prevent hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <WagmiCoreProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {mounted ? children : null}
      </QueryClientProvider>
    </WagmiCoreProvider>
  );
}
