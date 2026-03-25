import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "DEX | Swap & Bridge | 1OTC Exchange",
  description: "Multichain token exchange with minimal fees. Swap and Bridge between NEAR, Aurora, Ethereum, Polygon and other networks.",
  keywords: [
    "1OTC DEX",
    "multichain swap",
    "cross-chain bridge",
    "token exchange",
    "decentralized exchange",
    "Aurora swap",
    "1OTC Exchange",
    "token swap"
  ],
  openGraph: {
    title: "DEX | Swap & Bridge | 1OTC Exchange",
    description: "Multichain token exchange with minimal fees",
    type: "website",
  },
}

export default function DexLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

