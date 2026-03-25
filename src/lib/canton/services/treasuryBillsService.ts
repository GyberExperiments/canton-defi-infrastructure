/**
 * Treasury Bills Service — backed by Canton DAML contracts via Rust API.
 *
 * Treasury Bills are represented as OtcOffer contracts with asset symbols
 * prefixed with "T-BILL-" (e.g., T-BILL-3M, T-BILL-6M, T-BILL-12M).
 * Purchases create Settlement contracts on Canton Ledger.
 */

import {
  cantonApiClient,
  type CantonContract,
} from "./cantonApiClient";

// ─── Types ───

export interface TreasuryBill {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  cusip: string;
  isin: string;
  faceValue: number;
  currentPrice: number;
  yieldRate: number;
  maturity: string;
  maturityDate: string;
  couponRate: number;
  status: string;
  totalSupply: number;
  availableSupply: number;
  minInvestment: number;
  issueDate: string;
  createdAt: string;
}

export interface TreasuryBillHolding {
  id: string;
  billId: string;
  billSymbol: string;
  investor: string;
  amount: number;
  purchasePrice: number;
  purchaseDate: string;
  contractId: string;
}

export interface PurchaseRequest {
  billId: string;
  investor: string;
  amount: number;
  paymentMethod: string;
}

// ─── Helpers ───

const OPERATOR_PARTY =
  process.env.CANTON_PARTY_ID ||
  "otc-operator::12205aebe83cf5fabb6df16ed315a102eca1785d504405b0bb0fc243100b5a4768e4";

function contractToTreasuryBill(c: CantonContract): TreasuryBill {
  const symbol = c.asset.symbol;
  const maturityMap: Record<string, string> = {
    "T-BILL-1M": "1_MONTH",
    "T-BILL-3M": "3_MONTH",
    "T-BILL-6M": "6_MONTH",
    "T-BILL-12M": "12_MONTH",
  };
  const yieldMap: Record<string, number> = {
    "T-BILL-1M": 5.25,
    "T-BILL-3M": 5.28,
    "T-BILL-6M": 5.1,
    "T-BILL-12M": 4.85,
  };
  const faceValue = parseFloat(c.quantity) * parseFloat(c.price.rate);

  return {
    id: c.offer_id,
    contractId: c.contract_id,
    name: `US Treasury Bill ${symbol.replace("T-BILL-", "")}`,
    symbol,
    cusip: `912797${symbol.replace("T-BILL-", "").replace("M", "")}X1`,
    isin: `US912797${symbol.replace("T-BILL-", "").replace("M", "")}X`,
    faceValue,
    currentPrice: parseFloat(c.price.rate),
    yieldRate: yieldMap[symbol] ?? 5.0,
    maturity: maturityMap[symbol] ?? "6_MONTH",
    maturityDate: new Date(
      Date.now() +
        (symbol.includes("12")
          ? 365
          : symbol.includes("6")
            ? 182
            : symbol.includes("3")
              ? 91
              : 30) *
          86400000
    ).toISOString(),
    couponRate: 0,
    status: c.status === "active" ? "ACTIVE" : c.status.toUpperCase(),
    totalSupply: parseFloat(c.quantity),
    availableSupply: parseFloat(c.quantity),
    minInvestment: parseFloat(c.limits.min_amount),
    issueDate: c.timestamps.created,
    createdAt: c.created_at,
  };
}

// ─── Service ───

export class TreasuryBillsService {
  constructor(..._args: unknown[]) {
    // Accepts legacy constructor args for backward compatibility
  }

  async getAllTreasuryBills(): Promise<TreasuryBill[]> {
    const contracts = await cantonApiClient.listContracts();
    return contracts
      .filter((c) => c.asset.symbol.startsWith("T-BILL-"))
      .map(contractToTreasuryBill);
  }

  async getTreasuryBill(id: string): Promise<TreasuryBill | null> {
    const bills = await this.getAllTreasuryBills();
    return bills.find((b) => b.id === id) ?? null;
  }

  async createTreasuryBill(params: {
    name?: string;
    symbol: string;
    faceValue?: number;
    price?: number;
    quantity?: number;
    maturity?: string;
    yieldRate?: number;
  }): Promise<TreasuryBill> {
    const symbol = params.symbol.startsWith("T-BILL-")
      ? params.symbol
      : `T-BILL-${params.symbol}`;
    const quantity = String(params.quantity ?? 1000);
    const price = String(params.price ?? params.faceValue ?? 100);
    const orderId = `TBILL-${Date.now().toString(36).toUpperCase()}`;

    const result = await cantonApiClient.createOffer({
      order_id: orderId,
      initiator: OPERATOR_PARTY,
      asset: { symbol, amount: quantity, chain: "Canton" },
      price: { rate: price, currency: "USD" },
      quantity,
      side: "Sell",
      limits: { min_amount: "100", max_amount: quantity },
      min_compliance_level: "INSTITUTIONAL",
      allowed_jurisdictions: ["US", "CH", "SG", "EU"],
    });

    if (!result.success) {
      throw new Error(
        result.error ?? "Failed to create Treasury Bill on Canton"
      );
    }

    return {
      id: orderId,
      contractId: result.contract_id ?? "",
      name:
        params.name ?? `US Treasury Bill ${symbol.replace("T-BILL-", "")}`,
      symbol,
      cusip: `912797${symbol.replace("T-BILL-", "").replace("M", "")}X1`,
      isin: `US912797${symbol.replace("T-BILL-", "").replace("M", "")}X`,
      faceValue: parseFloat(quantity) * parseFloat(price),
      currentPrice: parseFloat(price),
      yieldRate: params.yieldRate ?? 5.0,
      maturity: params.maturity ?? "6_MONTH",
      maturityDate: new Date(Date.now() + 182 * 86400000).toISOString(),
      couponRate: 0,
      status: "ACTIVE",
      totalSupply: parseFloat(quantity),
      availableSupply: parseFloat(quantity),
      minInvestment: 100,
      issueDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
  }

  async purchaseTokens(params: PurchaseRequest): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    const bill = await this.getTreasuryBill(params.billId);
    if (!bill) return { success: false, error: "Bill not found" };

    const result = await cantonApiClient.createSettlement({
      offer_id: bill.id,
      trade_id: `TRD-${Date.now().toString(36).toUpperCase()}`,
      buyer: OPERATOR_PARTY,
      seller: OPERATOR_PARTY,
      asset_symbol: bill.symbol,
      asset_amount: String(params.amount),
      quantity: String(params.amount),
      price_rate: String(bill.currentPrice),
      price_currency: "USD",
      total_amount: String(params.amount * bill.currentPrice),
    });

    return {
      success: result.success,
      transactionId: result.transaction_id,
      error: result.error,
    };
  }

  async getInvestorPortfolio(
    _investorId: string
  ): Promise<TreasuryBillHolding[]> {
    const contracts = await cantonApiClient.listContracts();
    return contracts
      .filter((c) => c.asset.symbol.startsWith("T-BILL-"))
      .map((c) => ({
        id: `hold-${c.contract_id.slice(0, 8)}`,
        billId: c.offer_id,
        billSymbol: c.asset.symbol,
        investor: c.initiator,
        amount: parseFloat(c.quantity),
        purchasePrice: parseFloat(c.price.rate),
        purchaseDate: c.created_at,
        contractId: c.contract_id,
      }));
  }
}

// Singleton
let instance: TreasuryBillsService | null = null;
export function getTreasuryService(): TreasuryBillsService {
  if (!instance) instance = new TreasuryBillsService();
  return instance;
}
