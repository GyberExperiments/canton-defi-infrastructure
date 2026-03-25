'use client';

import { useState, useEffect, useCallback } from 'react';

// UI types (aligned with API responses)
export interface TreasuryBill {
  id: string;
  name: string;
  symbol: string;
  maturityDate: string;
  apy: number;
  pricePerToken: number;
  minInvestment: number;
  totalSupply: number;
  availableSupply: number;
  riskLevel: 'Ultra-Low' | 'Low' | 'Medium';
  status: 'live' | 'pending' | 'coming-soon';
  features: string[];
}

export interface TreasuryHolding {
  id: string;
  billId: string;
  billName: string;
  tokensOwned: number;
  averagePrice: number;
  currentValue: number;
  yieldEarned: number;
  purchaseDate: string;
  maturityDate: string;
}

export interface PurchaseTokensParams {
  billId: string;
  investorAddress: string;
  amount: number;
  paymentMethod: {
    type: string;
    currency: string;
    details: Record<string, unknown>;
  };
}

const BILLS_API = '/api/defi/treasury/bills';
const PORTFOLIO_API = '/api/defi/treasury/portfolio';
const PURCHASES_API = '/api/defi/treasury/purchases';

function mapApiBillToUi(row: Record<string, unknown>): TreasuryBill {
  const status = String(row.status ?? '');
  return {
    id: String(row.id ?? row.billId ?? ''),
    name: String(row.name ?? ''),
    symbol: String(row.symbol ?? ''),
    maturityDate: String(row.maturityDate ?? ''),
    apy: parseFloat(String(row.yieldRate ?? row.currentYield ?? row.expectedYield ?? 0)) || 0,
    pricePerToken: parseFloat(String(row.currentPrice ?? row.pricePerToken ?? 0)) || 0,
    minInvestment: parseFloat(String(row.minInvestment ?? row.minimumInvestment ?? 100)) || 100,
    totalSupply: parseFloat(String(row.totalSupply ?? 0)) || 0,
    availableSupply: parseFloat(String(row.availableSupply ?? 0)) || 0,
    riskLevel: 'Ultra-Low',
    status: status === 'ACTIVE' ? 'live' : status === 'SUSPENDED' ? 'pending' : 'coming-soon',
    features: ['T+0 settlement', 'Canton DAML', 'Institutional grade']
  };
}

function mapPortfolioByBillToHolding(byBill: { billId: string; billName: string; tokens: string; value: string; yield: string }, _maturityDate?: string): TreasuryHolding {
  const tokens = parseFloat(byBill.tokens) || 0;
  const value = parseFloat(byBill.value) || 0;
  return {
    id: byBill.billId,
    billId: byBill.billId,
    billName: byBill.billName,
    tokensOwned: tokens,
    averagePrice: tokens > 0 ? value / tokens : 0,
    currentValue: value,
    yieldEarned: parseFloat(byBill.yield) || 0,
    purchaseDate: '',
    maturityDate: _maturityDate ?? ''
  };
}

export function useTreasuryBills(address?: string | null) {
  const [availableBills, setAvailableBills] = useState<TreasuryBill[]>([]);
  const [userHoldings, setUserHoldings] = useState<TreasuryHolding[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Always load bills (Market tab works without wallet)
      const billsRes = await fetch(BILLS_API);
      if (!billsRes.ok) throw new Error('Failed to fetch bills');
      const billsJson = await billsRes.json();
      const bills: TreasuryBill[] = (billsJson.data ?? []).map(mapApiBillToUi);
      setAvailableBills(bills);

      // Load portfolio only if wallet connected
      if (address) {
        try {
          const portfolioRes = await fetch(`${PORTFOLIO_API}?investor=${encodeURIComponent(address)}`);
          if (portfolioRes.ok) {
            const portfolioJson = await portfolioRes.json();
            const byBill = (portfolioJson.data?.byBill ?? []) as Array<{ billId: string; billName: string; tokens: string; value: string; yield: string }>;
            setUserHoldings(byBill.map(b => mapPortfolioByBillToHolding(b)));
          }
        } catch {
          // Portfolio fetch failure is non-fatal
          setUserHoldings([]);
        }
      } else {
        setUserHoldings([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load treasury data'));
      console.error('Error loading treasury bills:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const purchaseTokens = useCallback(async (params: PurchaseTokensParams) => {
    if (!address) throw new Error('Wallet not connected');
    setIsLoading(true);
    setError(null);
    try {
      const bill = availableBills.find(b => b.id === params.billId);
      const pricePerToken = bill?.pricePerToken ?? 100;
      const numberOfTokens = params.amount / pricePerToken;
      const res = await fetch(PURCHASES_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: params.billId,
          investor: params.investorAddress,
          numberOfTokens,
          paymentData: {
            method: params.paymentMethod?.type ?? 'CRYPTO',
            currency: params.paymentMethod?.currency ?? 'USDT',
            walletAddress: params.investorAddress,
            ...params.paymentMethod?.details
          },
          approveImmediate: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Purchase failed');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to purchase tokens'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [address, availableBills, loadData]);

  const refreshData = useCallback(() => loadData(), [loadData]);

  return {
    availableBills,
    userHoldings,
    isLoading,
    error,
    purchaseTokens,
    refreshData
  };
}
