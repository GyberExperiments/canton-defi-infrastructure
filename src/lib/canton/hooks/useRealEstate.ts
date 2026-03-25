"use client";

import { useState, useEffect } from "react";
import Decimal from "decimal.js";
import {
  RealEstateTokenizationService,
  PropertyInfo,
  PropertyStatus,
  PropertyType,
  TokenPurchaseRequest,
  PaymentMethod,
} from "@/lib/canton/services/realEstateService";

// ========================================
// LOCAL TYPES
// ========================================

export interface Property {
  id: string;
  name: string;
  description: string;
  location: string;
  propertyType: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "MIXED_USE";
  totalValue: number;
  pricePerToken: number;
  totalTokens: number;
  availableTokens: number;
  expectedDividendYield: number;
  expectedAppreciation: number;
  fundingProgress: number;
  minInvestment: number;
  riskLevel: "Low" | "Medium" | "High";
  status: "live" | "funding" | "coming-soon";
  features: string[];
  images: string[];
  createdAt: string;
}

export interface PropertyHolding {
  id: string;
  propertyId: string;
  propertyName: string;
  tokensOwned: number;
  averagePrice: number;
  currentValue: number;
  totalDividendsReceived: number;
  purchaseDate: string;
  lastDividendDate: string;
  expectedAnnualYield: number;
}

export interface GovernanceProposal {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  proposalType: "MAINTENANCE" | "RENOVATION" | "SALE" | "REFINANCING" | "OTHER";
  proposedBy: string;
  createdAt: string;
  votingDeadline: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  status: "active" | "passed" | "rejected" | "executed";
}

export type PaymentMethodType = PaymentMethod["type"];

export interface PurchaseTokensParams {
  propertyId: string;
  investorAddress: string;
  numberOfTokens: number;
  totalAmount: Decimal;
  paymentMethod: {
    type: PaymentMethodType;
    currency: string;
    details: Record<string, unknown>;
  };
  kycLevel: TokenPurchaseRequest["kycLevel"];
  accreditedInvestor: boolean;
  investorCountry: string;
  privacyLevel: TokenPurchaseRequest["privacyLevel"];
  zkProofRequired: boolean;
}

export interface VoteOnProposalParams {
  proposalId: string;
  voterAddress: string;
  support: boolean;
}

// ========================================
// MAPPER FUNCTIONS
// ========================================

/**
 * Maps a PropertyType from the service to the local property type union.
 * Types that don't have a direct local equivalent are mapped to the closest match.
 */
function mapPropertyType(serviceType: PropertyType): Property["propertyType"] {
  switch (serviceType) {
    case "RESIDENTIAL":
      return "RESIDENTIAL";
    case "COMMERCIAL":
    case "RETAIL":
    case "HOSPITALITY":
    case "HEALTHCARE":
      return "COMMERCIAL";
    case "INDUSTRIAL":
      return "INDUSTRIAL";
    case "MIXED_USE":
    case "LAND":
    case "REIT_PORTFOLIO":
      return "MIXED_USE";
    default: {
      // Exhaustive check: if a new PropertyType is added, TypeScript will flag this
      const _exhaustive: never = serviceType;
      return "MIXED_USE";
    }
  }
}

/**
 * Maps a PropertyStatus from the service to the local status string.
 */
function mapPropertyStatus(serviceStatus: PropertyStatus): Property["status"] {
  switch (serviceStatus) {
    case "OPERATING":
    case "FULLY_FUNDED":
      return "live";
    case "FUNDING":
      return "funding";
    case "COMING_SOON":
    case "SOLD":
    case "DELISTED":
      return "coming-soon";
    default: {
      const _exhaustive: never = serviceStatus;
      return "coming-soon";
    }
  }
}

/**
 * Derives a risk level from property data heuristics.
 */
function deriveRiskLevel(info: PropertyInfo): Property["riskLevel"] {
  if (info.expectedDividendYield > 10) return "High";
  if (info.expectedDividendYield > 6) return "Medium";
  return "Low";
}

/**
 * Formats a PropertyLocation into a human-readable location string.
 */
function formatLocation(info: PropertyInfo): string {
  const loc = info.location;
  if (loc.neighborhood) {
    return `${loc.neighborhood}, ${loc.city}, ${loc.state}, ${loc.country}`;
  }
  return `${loc.city}, ${loc.state}, ${loc.country}`;
}

/**
 * Maps a PropertyInfo (from the service) to the local Property type.
 */
function mapPropertyInfoToProperty(info: PropertyInfo): Property {
  return {
    id: info.id,
    name: info.name,
    description: `${info.type} property at ${info.address}`,
    location: formatLocation(info),
    propertyType: mapPropertyType(info.type),
    totalValue: info.totalValue.toNumber(),
    pricePerToken: info.pricePerToken.toNumber(),
    totalTokens: info.tokenSupply,
    availableTokens: info.availableSupply,
    expectedDividendYield: info.expectedDividendYield,
    expectedAppreciation:
      info.marketData.marketTrend === "RISING"
        ? 5
        : info.marketData.marketTrend === "STABLE"
          ? 2
          : 0,
    fundingProgress: info.fundingProgress,
    minInvestment: info.minimumInvestment.toNumber(),
    riskLevel: deriveRiskLevel(info),
    status: mapPropertyStatus(info.status),
    features: info.amenities,
    images: info.images.map((img) => img.url),
    createdAt: info.tokenizationDate.toISOString(),
  };
}

/**
 * Maps raw holding data from the service (untyped) to the local PropertyHolding type.
 */
function mapToPropertyHolding(raw: {
  id: string;
  propertyId: string;
  propertyName: string;
  tokensOwned: number;
  averagePrice: number;
  currentValue: number;
  totalDividendsReceived: number;
  purchaseDate: string;
  lastDividendDate: string;
  expectedAnnualYield: number;
}): PropertyHolding {
  return {
    id: raw.id,
    propertyId: raw.propertyId,
    propertyName: raw.propertyName,
    tokensOwned: raw.tokensOwned,
    averagePrice: raw.averagePrice,
    currentValue: raw.currentValue,
    totalDividendsReceived: raw.totalDividendsReceived,
    purchaseDate: raw.purchaseDate,
    lastDividendDate: raw.lastDividendDate,
    expectedAnnualYield: raw.expectedAnnualYield,
  };
}

/**
 * Maps raw governance proposal data from the service to the local GovernanceProposal type.
 */
function mapToGovernanceProposal(raw: {
  id: string;
  propertyId: string;
  propertyName: string;
  title: string;
  description: string;
  proposalType: string;
  proposedBy: string;
  createdAt: string;
  votingDeadline: string;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  status: string;
}): GovernanceProposal {
  const validProposalTypes: GovernanceProposal["proposalType"][] = [
    "MAINTENANCE",
    "RENOVATION",
    "SALE",
    "REFINANCING",
    "OTHER",
  ];
  const proposalType = validProposalTypes.includes(
    raw.proposalType as GovernanceProposal["proposalType"],
  )
    ? (raw.proposalType as GovernanceProposal["proposalType"])
    : "OTHER";

  const validStatuses: GovernanceProposal["status"][] = [
    "active",
    "passed",
    "rejected",
    "executed",
  ];
  const status = validStatuses.includes(
    raw.status as GovernanceProposal["status"],
  )
    ? (raw.status as GovernanceProposal["status"])
    : "active";

  return {
    id: raw.id,
    propertyId: raw.propertyId,
    propertyName: raw.propertyName,
    title: raw.title,
    description: raw.description,
    proposalType,
    proposedBy: raw.proposedBy,
    createdAt: raw.createdAt,
    votingDeadline: raw.votingDeadline,
    votesFor: raw.votesFor,
    votesAgainst: raw.votesAgainst,
    totalVotes: raw.totalVotes,
    status,
  };
}

/**
 * Converts local PurchaseTokensParams to the service's TokenPurchaseRequest.
 */
function toTokenPurchaseRequest(
  params: PurchaseTokensParams,
): TokenPurchaseRequest {
  return {
    propertyId: params.propertyId,
    investorAddress: params.investorAddress,
    numberOfTokens: params.numberOfTokens,
    totalAmount: params.totalAmount,
    paymentMethod: {
      type: params.paymentMethod.type,
      currency: params.paymentMethod.currency,
      details: params.paymentMethod.details,
    },
    kycLevel: params.kycLevel,
    accreditedInvestor: params.accreditedInvestor,
    investorCountry: params.investorCountry,
    privacyLevel: params.privacyLevel,
    zkProofRequired: params.zkProofRequired,
  };
}

// ========================================
// HOOK
// ========================================

export const useRealEstate = (address?: string) => {
  const [availableProperties, setAvailableProperties] = useState<Property[]>(
    [],
  );
  const [userHoldings, setUserHoldings] = useState<PropertyHolding[]>([]);
  const [governanceProposals, setGovernanceProposals] = useState<
    GovernanceProposal[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const realEstateService = new RealEstateTokenizationService();

  useEffect(() => {
    if (!address) {
      setAvailableProperties([]);
      setUserHoldings([]);
      setGovernanceProposals([]);
      return;
    }

    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [properties, holdings, proposals] = await Promise.all([
          realEstateService.getAvailableProperties(),
          realEstateService.getUserHoldings(address),
          realEstateService.getGovernanceProposals(address),
        ]);
        setAvailableProperties(properties.map(mapPropertyInfoToProperty));
        setUserHoldings(
          (
            holdings as Array<{
              id: string;
              propertyId: string;
              propertyName: string;
              tokensOwned: number;
              averagePrice: number;
              currentValue: number;
              totalDividendsReceived: number;
              purchaseDate: string;
              lastDividendDate: string;
              expectedAnnualYield: number;
            }>
          ).map(mapToPropertyHolding),
        );
        setGovernanceProposals(
          (
            proposals as Array<{
              id: string;
              propertyId: string;
              propertyName: string;
              title: string;
              description: string;
              proposalType: string;
              proposedBy: string;
              createdAt: string;
              votingDeadline: string;
              votesFor: number;
              votesAgainst: number;
              totalVotes: number;
              status: string;
            }>
          ).map(mapToGovernanceProposal),
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error("Failed to load real estate data"),
        );
        console.error("Error loading real estate:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [address]);

  const purchaseTokens = async (params: PurchaseTokensParams) => {
    setIsLoading(true);
    setError(null);
    try {
      const request = toTokenPurchaseRequest(params);
      await realEstateService.purchaseTokens(request);
      // Reload data after purchase
      if (address) {
        const holdings = await realEstateService.getUserHoldings(address);
        setUserHoldings(
          (
            holdings as Array<{
              id: string;
              propertyId: string;
              propertyName: string;
              tokensOwned: number;
              averagePrice: number;
              currentValue: number;
              totalDividendsReceived: number;
              purchaseDate: string;
              lastDividendDate: string;
              expectedAnnualYield: number;
            }>
          ).map(mapToPropertyHolding),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to purchase tokens"),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const voteOnProposal = async (params: VoteOnProposalParams) => {
    setIsLoading(true);
    setError(null);
    try {
      await realEstateService.voteOnProposal(params);
      // Reload data after voting
      if (address) {
        const proposals =
          await realEstateService.getGovernanceProposals(address);
        setGovernanceProposals(
          (
            proposals as Array<{
              id: string;
              propertyId: string;
              propertyName: string;
              title: string;
              description: string;
              proposalType: string;
              proposedBy: string;
              createdAt: string;
              votingDeadline: string;
              votesFor: number;
              votesAgainst: number;
              totalVotes: number;
              status: string;
            }>
          ).map(mapToGovernanceProposal),
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to vote on proposal"),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);
    try {
      const [properties, holdings, proposals] = await Promise.all([
        realEstateService.getAvailableProperties(),
        realEstateService.getUserHoldings(address),
        realEstateService.getGovernanceProposals(address),
      ]);
      setAvailableProperties(properties.map(mapPropertyInfoToProperty));
      setUserHoldings(
        (
          holdings as Array<{
            id: string;
            propertyId: string;
            propertyName: string;
            tokensOwned: number;
            averagePrice: number;
            currentValue: number;
            totalDividendsReceived: number;
            purchaseDate: string;
            lastDividendDate: string;
            expectedAnnualYield: number;
          }>
        ).map(mapToPropertyHolding),
      );
      setGovernanceProposals(
        (
          proposals as Array<{
            id: string;
            propertyId: string;
            propertyName: string;
            title: string;
            description: string;
            proposalType: string;
            proposedBy: string;
            createdAt: string;
            votingDeadline: string;
            votesFor: number;
            votesAgainst: number;
            totalVotes: number;
            status: string;
          }>
        ).map(mapToGovernanceProposal),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to refresh data"),
      );
      console.error("Error refreshing real estate:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    availableProperties,
    userHoldings,
    governanceProposals,
    isLoading,
    error,
    purchaseTokens,
    voteOnProposal,
    refreshData,
  };
};
