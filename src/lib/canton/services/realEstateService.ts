/**
 * Real Estate Tokenization Service — backed by Canton DAML contracts via Rust API.
 *
 * Properties are represented as OtcOffer contracts with asset symbols
 * prefixed with "PROP-" (e.g., PROP-NYC-001, PROP-LDN-001).
 * Purchases use Escrow contracts for secure transfer.
 */

import {
  cantonApiClient,
  type CantonContract,
} from "./cantonApiClient";

// ─── Types ───

export interface PropertyInfo {
  id: string;
  contractId: string;
  name: string;
  symbol: string;
  location: string;
  type: string;
  totalValue: number;
  tokenPrice: number;
  totalTokens: number;
  availableTokens: number;
  annualYield: number;
  status: string;
  imageUrl: string;
  description: string;
  createdAt: string;
}

export interface PropertyHolding {
  id: string;
  propertyId: string;
  propertySymbol: string;
  investor: string;
  tokens: number;
  value: number;
  purchaseDate: string;
  contractId: string;
}

export interface GovernanceProposal {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  status: string;
  votesFor: number;
  votesAgainst: number;
  deadline: string;
}

// ─── Helpers ───

const OPERATOR_PARTY =
  process.env.CANTON_PARTY_ID ||
  "otc-operator::12205aebe83cf5fabb6df16ed315a102eca1785d504405b0bb0fc243100b5a4768e4";

const PROPERTY_META: Record<string, { name: string; location: string; type: string; yield: number; image: string; desc: string }> = {
  "PROP-NYC-001": {
    name: "Manhattan Office Tower",
    location: "350 5th Avenue, New York, NY",
    type: "Commercial Office",
    yield: 6.8,
    image: "/images/properties/nyc-office.jpg",
    desc: "Class A office space in Midtown Manhattan, 42 floors, LEED Platinum certified",
  },
  "PROP-LDN-001": {
    name: "Canary Wharf Residence",
    location: "1 Canada Square, London E14",
    type: "Residential",
    yield: 5.2,
    image: "/images/properties/london-residence.jpg",
    desc: "Luxury residential complex, 180 units, Thames waterfront views",
  },
  "PROP-SGP-001": {
    name: "Marina Bay Commercial Hub",
    location: "10 Marina Boulevard, Singapore",
    type: "Mixed Use",
    yield: 7.1,
    image: "/images/properties/singapore-hub.jpg",
    desc: "Grade A mixed-use development, retail + office, 98% occupancy",
  },
};

function contractToProperty(c: CantonContract): PropertyInfo {
  const symbol = c.asset.symbol;
  const meta = PROPERTY_META[symbol] ?? {
    name: `Property ${symbol}`,
    location: "Unknown",
    type: "Other",
    yield: 5.0,
    image: "",
    desc: "",
  };

  return {
    id: c.offer_id,
    contractId: c.contract_id,
    name: meta.name,
    symbol,
    location: meta.location,
    type: meta.type,
    totalValue: parseFloat(c.quantity) * parseFloat(c.price.rate),
    tokenPrice: parseFloat(c.price.rate),
    totalTokens: parseFloat(c.quantity),
    availableTokens: parseFloat(c.quantity),
    annualYield: meta.yield,
    status: c.status === "active" ? "AVAILABLE" : c.status.toUpperCase(),
    imageUrl: meta.image,
    description: meta.desc,
    createdAt: c.created_at,
  };
}

// ─── Service ───

export class RealEstateTokenizationService {
  async getAvailableProperties(): Promise<PropertyInfo[]> {
    const contracts = await cantonApiClient.listContracts();
    return contracts
      .filter((c) => c.asset.symbol.startsWith("PROP-"))
      .map(contractToProperty);
  }

  async getProperty(id: string): Promise<PropertyInfo | null> {
    const properties = await this.getAvailableProperties();
    return properties.find((p) => p.id === id) ?? null;
  }

  async tokenizeProperty(params: {
    symbol: string;
    name?: string;
    totalTokens?: number;
    tokenPrice?: number;
  }): Promise<PropertyInfo> {
    const symbol = params.symbol.startsWith("PROP-")
      ? params.symbol
      : `PROP-${params.symbol}`;
    const quantity = String(params.totalTokens ?? 10000);
    const price = String(params.tokenPrice ?? 100);
    const orderId = `PROP-${Date.now().toString(36).toUpperCase()}`;

    const result = await cantonApiClient.createOffer({
      order_id: orderId,
      initiator: OPERATOR_PARTY,
      asset: { symbol, amount: quantity, chain: "Canton" },
      price: { rate: price, currency: "USD" },
      quantity,
      side: "Sell",
      limits: { min_amount: "1", max_amount: quantity },
      min_compliance_level: "INSTITUTIONAL",
      allowed_jurisdictions: ["US", "UK", "SG", "CH", "EU"],
    });

    if (!result.success) {
      throw new Error(result.error ?? "Failed to tokenize property on Canton");
    }

    const meta = PROPERTY_META[symbol];
    return {
      id: orderId,
      contractId: result.contract_id ?? "",
      name: params.name ?? meta?.name ?? `Property ${symbol}`,
      symbol,
      location: meta?.location ?? "TBD",
      type: meta?.type ?? "Other",
      totalValue: parseFloat(quantity) * parseFloat(price),
      tokenPrice: parseFloat(price),
      totalTokens: parseFloat(quantity),
      availableTokens: parseFloat(quantity),
      annualYield: meta?.yield ?? 5.0,
      status: "AVAILABLE",
      imageUrl: meta?.image ?? "",
      description: meta?.desc ?? "",
      createdAt: new Date().toISOString(),
    };
  }

  async purchaseProperty(params: {
    propertyId: string;
    buyer: string;
    tokens: number;
  }): Promise<{ success: boolean; escrowId?: string; error?: string }> {
    const property = await this.getProperty(params.propertyId);
    if (!property) return { success: false, error: "Property not found" };

    const result = await cantonApiClient.createEscrow({
      offer_id: property.id,
      buyer: OPERATOR_PARTY,
      seller: OPERATOR_PARTY,
      arbiter: OPERATOR_PARTY,
      asset: {
        symbol: property.symbol,
        amount: String(params.tokens),
        chain: "Canton",
      },
      amount: String(params.tokens * property.tokenPrice),
      release_conditions: `Transfer ${params.tokens} tokens of ${property.symbol} to buyer`,
      refund_conditions: "Seller fails to transfer tokens within 7 days",
      deadline_hours: 168,
    });

    return {
      success: result.success,
      escrowId: result.escrow_id,
      error: result.error,
    };
  }

  async getUserHoldings(_userId: string): Promise<PropertyHolding[]> {
    const contracts = await cantonApiClient.listContracts();
    return contracts
      .filter((c) => c.asset.symbol.startsWith("PROP-"))
      .map((c) => ({
        id: `hold-${c.contract_id.slice(0, 8)}`,
        propertyId: c.offer_id,
        propertySymbol: c.asset.symbol,
        investor: c.initiator,
        tokens: parseFloat(c.quantity),
        value: parseFloat(c.quantity) * parseFloat(c.price.rate),
        purchaseDate: c.created_at,
        contractId: c.contract_id,
      }));
  }

  async getGovernanceProposals(
    _propertyId: string
  ): Promise<GovernanceProposal[]> {
    // Governance proposals will use Escrow contracts in future
    return [];
  }
}

let instance: RealEstateTokenizationService | null = null;
export function getRealEstateService(): RealEstateTokenizationService {
  if (!instance) instance = new RealEstateTokenizationService();
  return instance;
}
