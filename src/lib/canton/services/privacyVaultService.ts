/**
 * Privacy Vault Service — backed by Canton DAML Collateral contracts via Rust API.
 *
 * Privacy Vaults are represented as Collateral contracts with asset symbols
 * prefixed with "VAULT-". Canton's sub-transaction privacy ensures
 * vault contents are visible only to authorized parties.
 */

import { cantonApiClient } from "./cantonApiClient";

// ─── Types ───

export interface PrivacyVault {
  id: string;
  contractId: string;
  name: string;
  asset: string;
  totalAmount: number;
  availableAmount: number;
  lockedAmount: number;
  status: string;
  privacyLevel: string;
  createdAt: string;
}

export interface VaultTransaction {
  id: string;
  vaultId: string;
  type: "DEPOSIT" | "WITHDRAW" | "LOCK" | "UNLOCK";
  amount: number;
  timestamp: string;
}

// ─── Helpers ───

const OPERATOR_PARTY =
  process.env.CANTON_PARTY_ID ||
  "otc-operator::12205aebe83cf5fabb6df16ed315a102eca1785d504405b0bb0fc243100b5a4768e4";

// ─── Service ───

export class PrivacyVaultService {
  constructor(..._args: unknown[]) {
    // Accepts legacy constructor args
  }

  async getUserVaults(_userId?: string): Promise<PrivacyVault[]> {
    // Collateral contracts starting with VAULT- are privacy vaults
    const contracts = await cantonApiClient.listContracts();
    // We use the OTC contracts list but filter for VAULT- prefix
    // In future, add a dedicated /api/v1/collateral/list endpoint
    return contracts
      .filter((c) => c.asset.symbol.startsWith("VAULT-"))
      .map((c) => ({
        id: c.offer_id,
        contractId: c.contract_id,
        name: `Privacy Vault ${c.asset.symbol.replace("VAULT-", "")}`,
        asset: c.asset.symbol,
        totalAmount: parseFloat(c.quantity),
        availableAmount: parseFloat(c.quantity),
        lockedAmount: 0,
        status: c.status === "active" ? "ACTIVE" : c.status.toUpperCase(),
        privacyLevel: "CANTON_SUB_TX",
        createdAt: c.created_at,
      }));
  }

  async createPrivacyVault(params: {
    name?: string;
    asset: string;
    amount: number;
  }): Promise<PrivacyVault> {
    const symbol = `VAULT-${params.asset}`;
    const amountStr = String(params.amount);

    // Create as Collateral contract on Canton
    const result = await cantonApiClient.createCollateral({
      owner: OPERATOR_PARTY,
      asset_symbol: symbol,
      asset_amount: amountStr,
      asset_chain: "Canton",
      amount: amountStr,
    });

    if (!result.success) {
      throw new Error(
        result.error ?? "Failed to create Privacy Vault on Canton"
      );
    }

    return {
      id: result.collateral_id ?? `vault-${Date.now()}`,
      contractId: result.contract_id ?? "",
      name: params.name ?? `Privacy Vault ${params.asset}`,
      asset: symbol,
      totalAmount: params.amount,
      availableAmount: params.amount,
      lockedAmount: 0,
      status: "ACTIVE",
      privacyLevel: "CANTON_SUB_TX",
      createdAt: new Date().toISOString(),
    };
  }

  async depositToVault(params: {
    vaultContractId: string;
    amount: number;
    offerId: string;
  }): Promise<{ success: boolean; error?: string }> {
    return cantonApiClient.lockCollateral({
      contract_id: params.vaultContractId,
      amount: String(params.amount),
      lock_offer_id: params.offerId,
      lock_duration_hours: 8760, // 1 year
    });
  }

  async withdrawFromVault(params: {
    vaultContractId: string;
    amount: number;
  }): Promise<{ success: boolean; error?: string }> {
    return cantonApiClient.releaseCollateral({
      contract_id: params.vaultContractId,
      amount: String(params.amount),
    });
  }

  async getVaultTransactions(_vaultId: string): Promise<VaultTransaction[]> {
    // Transaction history will come from ledger event stream in future
    return [];
  }
}

let instance: PrivacyVaultService | null = null;
export function getPrivacyVaultService(): PrivacyVaultService {
  if (!instance) instance = new PrivacyVaultService();
  return instance;
}
