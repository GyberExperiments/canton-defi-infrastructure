'use client';

import { http, createConfig } from 'wagmi';
import { mainnet, bsc, polygon, optimism, arbitrum } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Custom Canton Network chain (if needed)
export const cantonNetwork = {
  id: 7575,
  name: 'Canton Network',
  nativeCurrency: {
    decimals: 18,
    name: 'Canton Coin',
    symbol: 'CC',
  },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_CANTON_RPC_URL || 'https://rpc.canton.network'] },
  },
  blockExplorers: {
    default: { name: 'Canton Explorer', url: 'https://explorer.canton.network' },
  },
} as const;

// NOTE:
// We intentionally avoid RainbowKit's getDefaultConfig() here because it pulls in many optional connectors
// that have optional/peer dependencies (coinbase/metamask/walletconnect/safe/etc). In Next.js builds,
// those can fail hard if the optional deps are not installed.
//
// This config keeps a minimal injected connector (MetaMask/Brave/etc via window.ethereum) and remains SSR-safe.
export const wagmiConfig = createConfig({
  chains: [mainnet, bsc, polygon, optimism, arbitrum, cantonNetwork],
  connectors: [
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
    [polygon.id]: http(),
    [optimism.id]: http(),
    [arbitrum.id]: http(),
    [cantonNetwork.id]: http(),
  },
  ssr: true,
});

export const SUPPORTED_CHAINS = [mainnet, bsc, polygon, optimism, arbitrum, cantonNetwork];
