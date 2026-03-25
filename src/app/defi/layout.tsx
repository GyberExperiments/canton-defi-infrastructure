import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Canton DeFi | Institutional DeFi Platform',
  description: 'Revolutionary institutional DeFi platform with Canton Network integration. Access real estate tokenization, AI portfolio optimization, and privacy-preserving vaults.',
  keywords: [
    'Canton DeFi',
    'Institutional DeFi', 
    'Real Estate Tokenization',
    'AI Portfolio',
    'Privacy Vaults',
    'DAML Smart Contracts',
    'Canton Network'
  ],
  openGraph: {
    title: 'Canton DeFi | Institutional DeFi Platform',
    description: 'Access institutional-grade DeFi products with Canton Network integration',
    type: 'website',
    url: 'https://1otc.cc/defi',
  },
};

export default function DeFiLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
