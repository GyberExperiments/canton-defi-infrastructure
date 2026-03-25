/**
 * Canton API Client — Single REST client for all Rust Canton API calls.
 *
 * All DeFi services (Treasury, Real Estate, Privacy Vault) use this client
 * instead of mock data. The Rust API handles DAML contract operations
 * via Canton Ledger API v2 gRPC.
 */

// Read env at call time (not module load) for Next.js standalone compatibility
function getApiUrl(): string {
  return process.env.CANTON_API_SERVER_URL || "http://canton-api-server:8080";
}
function getServiceToken(): string {
  return process.env.CANTON_API_SERVICE_TOKEN || "";
}

interface ApiResponse<T> {
  data: T | null;
  error: string | null;
}

async function cantonFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  const token = getServiceToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${getApiUrl()}${path}`, {
      ...options,
      headers,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { data: null, error: `${res.status}: ${text}` };
    }

    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── Types ───

export interface CantonAsset {
  symbol: string;
  amount: string;
  chain: string;
  contract_address?: string;
}

export interface CantonPrice {
  rate: string;
  currency: string;
}

export interface CantonContract {
  contract_id: string;
  transaction_id?: string;
  offer_id: string;
  operator: string;
  initiator: string;
  asset: CantonAsset;
  price: CantonPrice;
  quantity: string;
  side: string;
  limits: { min_amount: string; max_amount: string };
  status: string;
  timestamps: { created: string; updated: string };
  min_compliance_level: string;
  allowed_jurisdictions: string[];
  auditors: string[];
  created_at: string;
}

export interface CreateOfferResponse {
  success: boolean;
  contract_id?: string;
  transaction_id?: string;
  order_id: string;
  error?: string;
}

export interface CreateCollateralResponse {
  success: boolean;
  contract_id?: string;
  transaction_id?: string;
  collateral_id?: string;
  error?: string;
}

export interface CreateEscrowResponse {
  success: boolean;
  contract_id?: string;
  transaction_id?: string;
  escrow_id?: string;
  error?: string;
}

export interface CreateSettlementResponse {
  success: boolean;
  contract_id?: string;
  transaction_id?: string;
  settlement_id?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  connected: boolean;
  participant: string;
  mode: string;
  ledger_end: string | null;
  application_id: string;
  version: string;
  party_id: string;
}

// ─── Client Methods ───

export const cantonApiClient = {
  /** Health check (no auth required) */
  async getHealth(): Promise<HealthResponse | null> {
    const { data } = await cantonFetch<HealthResponse>("/health");
    return data;
  },

  /** List all OTC contracts */
  async listContracts(): Promise<CantonContract[]> {
    const { data } = await cantonFetch<{
      contracts: CantonContract[];
      total: number;
    }>("/api/v1/contracts");
    return data?.contracts ?? [];
  },

  /** List active contracts from ledger */
  async listActiveContracts(): Promise<CantonContract[]> {
    const { data } = await cantonFetch<{
      contracts: CantonContract[];
      total: number;
    }>("/api/v1/contracts/active");
    return data?.contracts ?? [];
  },

  /** Create OTC offer (generic — used for T-Bills, Properties, etc.) */
  async createOffer(params: {
    order_id: string;
    initiator: string;
    asset: CantonAsset;
    price: CantonPrice;
    quantity: string;
    side: string;
    limits: { min_amount: string; max_amount: string };
    min_compliance_level?: string;
    allowed_jurisdictions?: string[];
  }): Promise<CreateOfferResponse> {
    const { data, error } = await cantonFetch<CreateOfferResponse>(
      "/api/v1/contracts/offer",
      {
        method: "POST",
        body: JSON.stringify({
          ...params,
          min_compliance_level: params.min_compliance_level ?? "INSTITUTIONAL",
          allowed_jurisdictions: params.allowed_jurisdictions ?? [],
          auditors: [],
        }),
      }
    );
    return data ?? { success: false, order_id: params.order_id, error: error ?? "Unknown error" };
  },

  /** Create collateral (used for Privacy Vaults) */
  async createCollateral(params: {
    collateral_id?: string;
    offer_id?: string;
    owner: string;
    asset_symbol: string;
    asset_amount: string;
    asset_chain?: string;
    amount: string;
  }): Promise<CreateCollateralResponse> {
    const { data, error } = await cantonFetch<CreateCollateralResponse>(
      "/api/v1/collateral/create",
      {
        method: "POST",
        body: JSON.stringify({
          collateral_id: params.collateral_id ?? `col-${Date.now()}`,
          offer_id: params.offer_id,
          owner: params.owner,
          asset_symbol: params.asset_symbol,
          asset_amount: params.asset_amount,
          asset_chain: params.asset_chain ?? "Canton",
          amount: params.amount,
          initial_amount: params.amount,
          current_amount: params.amount,
          locked_amount: "0.0",
          status: "CollateralAvailable",
        }),
      }
    );
    return data ?? { success: false, error: error ?? "Unknown error" };
  },

  /** Lock collateral (deposit to vault) */
  async lockCollateral(params: {
    contract_id: string;
    amount: string;
    lock_offer_id: string;
    lock_duration_hours?: number;
  }): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await cantonFetch<{
      success: boolean;
      error?: string;
    }>("/api/v1/collateral/lock", {
      method: "POST",
      body: JSON.stringify({
        ...params,
        lock_duration_hours: params.lock_duration_hours ?? 720,
      }),
    });
    return data ?? { success: false, error: error ?? "Unknown error" };
  },

  /** Release collateral (withdraw from vault) */
  async releaseCollateral(params: {
    contract_id: string;
    amount: string;
  }): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await cantonFetch<{
      success: boolean;
      error?: string;
    }>("/api/v1/collateral/release", {
      method: "POST",
      body: JSON.stringify(params),
    });
    return data ?? { success: false, error: error ?? "Unknown error" };
  },

  /** Create escrow (used for Real Estate purchases) */
  async createEscrow(params: {
    offer_id: string;
    buyer: string;
    seller: string;
    arbiter: string;
    asset: CantonAsset;
    amount: string;
    release_conditions: string;
    refund_conditions: string;
    deadline_hours?: number;
  }): Promise<CreateEscrowResponse> {
    const { data, error } = await cantonFetch<CreateEscrowResponse>(
      "/api/v1/escrow/create",
      {
        method: "POST",
        body: JSON.stringify({
          ...params,
          deposited_amount: "0.0",
          status: "Created",
          deadline_hours: params.deadline_hours ?? 168,
          max_extensions: 3,
          auditors: [],
        }),
      }
    );
    return data ?? { success: false, error: error ?? "Unknown error" };
  },

  /** Create settlement (used for Treasury purchases) */
  async createSettlement(params: {
    offer_id: string;
    trade_id: string;
    buyer: string;
    seller: string;
    asset_symbol: string;
    asset_amount: string;
    quantity: string;
    price_rate: string;
    price_currency: string;
    total_amount: string;
  }): Promise<CreateSettlementResponse> {
    const { data, error } = await cantonFetch<CreateSettlementResponse>(
      "/api/v1/settlements/create",
      {
        method: "POST",
        body: JSON.stringify({
          ...params,
          asset_chain: "Canton",
          required_confirmations: 2,
          status: "PendingPayment",
          deadline_hours: 48,
          auditors: [],
        }),
      }
    );
    return data ?? { success: false, error: error ?? "Unknown error" };
  },

  /** List settlements */
  async listSettlements(): Promise<
    Array<{ contract_id: string; settlement_id: string; status: string }>
  > {
    const { data } = await cantonFetch<{
      settlements: Array<{
        contract_id: string;
        settlement_id: string;
        status: string;
      }>;
    }>("/api/v1/settlements");
    return data?.settlements ?? [];
  },
};
