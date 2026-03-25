"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Building2,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Users,
  BarChart3,
  Star,
  X,
  Clock,
  ArrowUpRight,
  Percent,
} from "lucide-react";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useRealEstateService } from "@/lib/canton/services/realEstateService";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

// Types
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

// Real Estate Panel Component
export const RealEstatePanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(
    null,
  );
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseAmount, setPurchaseAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "market" | "holdings" | "governance"
  >("market");
  const [showPropertyDetails, setShowPropertyDetails] = useState(false);

  // Use Real Estate Service
  const {
    availableProperties: rawProperties,
    isLoading,
    purchaseTokens: servicePurchaseTokens,
    service,
  } = useRealEstateService();

  // Local state for data not provided by the hook
  const [userHoldings, setUserHoldings] = useState<PropertyHolding[]>([]);
  const [governanceProposals, setGovernanceProposals] = useState<
    GovernanceProposal[]
  >([]);
  const [error, setError] = useState<Error | null>(null);

  // Adapt service PropertyInfo[] to local Property[] view model
  const availableProperties: Property[] = useMemo(() => {
    return (rawProperties || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description || "",
      location:
        typeof p.location === "object"
          ? `${p.location.city}, ${p.location.country}`
          : String(p.location || ""),
      propertyType: p.type || p.propertyType || "RESIDENTIAL",
      totalValue: Number(p.totalValue || 0),
      pricePerToken: Number(p.pricePerToken || 0),
      totalTokens: p.tokenSupply || p.totalTokens || 0,
      availableTokens: p.availableSupply || p.availableTokens || 0,
      expectedDividendYield: p.expectedDividendYield || 0,
      expectedAppreciation: p.expectedAppreciation || 0,
      fundingProgress: p.fundingProgress || 0,
      minInvestment: Number(p.minimumInvestment || p.minInvestment || 0),
      riskLevel: p.riskLevel || "Medium",
      status:
        p.status === "OPERATING"
          ? "live"
          : p.status === "FUNDING"
            ? "funding"
            : "coming-soon",
      features: p.amenities || p.features || [],
      images: p.images || [],
      createdAt: p.createdAt || new Date().toISOString(),
    }));
  }, [rawProperties]);

  const purchaseTokens = async (params: any) => {
    return servicePurchaseTokens(params);
  };

  const voteOnProposal = async (_params: any) => {
    // Not available in service hook
  };

  const refreshData = async () => {
    // Refresh handled internally by service
  };

  // Calculate portfolio stats
  const portfolioStats = useMemo(() => {
    if (!userHoldings || userHoldings.length === 0) {
      return {
        totalValue: 0,
        totalDividends: 0,
        averageYield: 0,
        holdingsCount: 0,
      };
    }

    const totalValue = userHoldings.reduce((sum, h) => sum + h.currentValue, 0);
    const totalDividends = userHoldings.reduce(
      (sum, h) => sum + h.totalDividendsReceived,
      0,
    );
    const averageYield =
      userHoldings.reduce((sum, h) => sum + h.expectedAnnualYield, 0) /
      userHoldings.length;

    return {
      totalValue,
      totalDividends,
      averageYield,
      holdingsCount: userHoldings.length,
    };
  }, [userHoldings]);

  // Handle purchase
  const handlePurchase = async () => {
    if (!selectedProperty || !address || !isConnected) {
      toast.error("Подключите кошелек для покупки");
      return;
    }

    const amount = parseFloat(purchaseAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Введите корректную сумму");
      return;
    }

    if (amount < selectedProperty.minInvestment) {
      toast.error(
        `Минимальная сумма: $${selectedProperty.minInvestment.toLocaleString()}`,
      );
      return;
    }

    setIsProcessing(true);
    try {
      const tokensToBuy = Math.floor(amount / selectedProperty.pricePerToken);

      await purchaseTokens({
        propertyId: selectedProperty.id,
        investorAddress: address,
        numberOfTokens: tokensToBuy,
        totalAmount: amount,
        paymentMethod: { type: "CRYPTO", currency: "USDT", details: {} },
        kycLevel: "BASIC",
        accreditedInvestor: false,
        investorCountry: "US",
        privacyLevel: "STANDARD",
        zkProofRequired: false,
      });

      toast.success(`✅ Успешно куплено ${tokensToBuy} токенов`);
      setShowPurchaseModal(false);
      setPurchaseAmount("");
      setSelectedProperty(null);
      await refreshData();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Ошибка при покупке";
      toast.error(`❌ ${errorMsg}`);
      console.error("Purchase error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle voting
  const handleVote = async (proposalId: string, support: boolean) => {
    if (!address || !isConnected) {
      toast.error("Подключите кошелек для голосования");
      return;
    }

    setIsProcessing(true);
    try {
      await voteOnProposal({
        proposalId,
        voterAddress: address,
        support,
      });

      toast.success(`✅ Голос ${support ? "ЗА" : "ПРОТИВ"} успешно отправлен`);
      await refreshData();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Ошибка при голосовании";
      toast.error(`❌ ${errorMsg}`);
      console.error("Vote error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Risk level config
  const riskConfig = {
    Low: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Low" },
    Medium: { color: "text-amber-400", bg: "bg-amber-500/10", label: "Medium" },
    High: { color: "text-red-400", bg: "bg-red-500/10", label: "High" },
  };

  // Status config
  const statusConfig = {
    live: {
      label: "Live",
      icon: CheckCircle,
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-400/30",
    },
    funding: {
      label: "Funding",
      icon: Clock,
      className: "bg-blue-500/20 text-blue-400 border-blue-400/30",
    },
    "coming-soon": {
      label: "Coming Soon",
      icon: AlertCircle,
      className: "bg-gray-500/20 text-gray-400 border-gray-400/30",
    },
  };

  // Property type config
  const propertyTypeConfig = {
    RESIDENTIAL: {
      label: "Residential",
      icon: Home,
      color: "from-blue-500 to-cyan-500",
    },
    COMMERCIAL: {
      label: "Commercial",
      icon: Building2,
      color: "from-purple-500 to-pink-500",
    },
    INDUSTRIAL: {
      label: "Industrial",
      icon: Building2,
      color: "from-orange-500 to-red-500",
    },
    MIXED_USE: {
      label: "Mixed Use",
      icon: Building2,
      color: "from-emerald-500 to-green-500",
    },
  };

  if (error) {
    return <ErrorState message={error.message} onRetry={refreshData} />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-full border border-emerald-400/30 mb-6">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="text-emerald-300 text-sm font-medium">
            Real Estate Tokenization
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-400">
            Fractional Real Estate
          </span>
        </h2>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          Invest in institutional-grade real estate with automatic rent
          distribution and governance voting
        </p>
      </motion.div>

      {/* Portfolio Stats */}
      {isConnected && userHoldings && userHoldings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            {
              label: "Total Value",
              value: `$${portfolioStats.totalValue.toLocaleString()}`,
              icon: DollarSign,
              color: "text-emerald-400",
            },
            {
              label: "Total Dividends",
              value: `$${portfolioStats.totalDividends.toLocaleString()}`,
              icon: TrendingUp,
              color: "text-cyan-400",
            },
            {
              label: "Average Yield",
              value: `${portfolioStats.averageYield.toFixed(1)}%`,
              icon: Percent,
              color: "text-blue-400",
            },
            {
              label: "Properties",
              value: portfolioStats.holdingsCount.toString(),
              icon: Home,
              color: "text-purple-400",
            },
          ].map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
            >
              <stat.icon className={`w-8 h-8 ${stat.color} mb-3`} />
              <div className="text-2xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-gray-400 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <div className="flex bg-white/5 backdrop-blur-xl rounded-2xl p-2 border border-white/10">
          {[
            { id: "market", name: "Market", icon: Building2 },
            { id: "holdings", name: "My Holdings", icon: Home },
            { id: "governance", name: "Governance", icon: Users },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg"
                  : "text-gray-300 hover:text-white hover:bg-white/10",
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === "market" && (
          <motion.div
            key="market"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : !availableProperties || availableProperties.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Properties Available"
                description="Check back soon for new real estate investment opportunities."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableProperties.map((property, index) => {
                  const riskInfo = riskConfig[property.riskLevel];
                  const statusInfo = statusConfig[property.status];
                  const StatusIcon = statusInfo.icon;
                  const typeInfo = propertyTypeConfig[property.propertyType];
                  const TypeIcon = typeInfo.icon;

                  return (
                    <motion.div
                      key={property.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl overflow-hidden border border-white/10 hover:border-white/20 transition-all duration-300 group"
                    >
                      {/* Property Image */}
                      <div className="relative h-48 bg-gradient-to-br from-emerald-500/20 to-green-500/20">
                        <div className="absolute inset-0 flex items-center justify-center">
                          <TypeIcon className="w-16 h-16 text-emerald-400/50" />
                        </div>

                        {/* Status Badge */}
                        <div className="absolute top-4 right-4 flex items-center gap-2">
                          <div
                            className={cn(
                              "w-2 h-2 rounded-full animate-pulse",
                              property.status === "live"
                                ? "bg-emerald-400"
                                : "bg-blue-400",
                            )}
                          />
                          <div
                            className={cn(
                              "px-3 py-1 rounded-full text-xs font-medium border flex items-center gap-1.5",
                              statusInfo.className,
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            <span>{statusInfo.label}</span>
                          </div>
                        </div>

                        {/* Funding Progress */}
                        {property.status === "funding" && (
                          <div className="absolute bottom-4 left-4 right-4">
                            <div className="flex justify-between text-xs text-white mb-1">
                              <span>Funding Progress</span>
                              <span>
                                {(property.fundingProgress * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
                                style={{
                                  width: `${property.fundingProgress * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Property Info */}
                      <div className="p-6">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">
                              {property.name}
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{property.location}</span>
                            </div>
                          </div>
                          <div
                            className={cn(
                              "px-2 py-1 rounded-lg text-xs font-medium",
                              riskInfo.bg,
                            )}
                          >
                            <span className={riskInfo.color}>
                              {riskInfo.label} Risk
                            </span>
                          </div>
                        </div>

                        {/* Key Metrics */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          <div>
                            <div className="text-2xl font-bold text-emerald-400 mb-1">
                              {property.expectedDividendYield.toFixed(1)}%
                            </div>
                            <div className="text-xs text-gray-400">
                              Dividend Yield
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-white mb-1">
                              ${property.pricePerToken.toFixed(2)}
                            </div>
                            <div className="text-xs text-gray-400">
                              Per Token
                            </div>
                          </div>
                        </div>

                        {/* Expected Appreciation */}
                        <div className="flex items-center gap-2 mb-4 text-sm text-gray-300">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span>
                            Expected appreciation:{" "}
                            {property.expectedAppreciation.toFixed(1)}%/year
                          </span>
                        </div>

                        {/* Features */}
                        <div className="space-y-1.5 mb-4">
                          {property.features.slice(0, 3).map((feature, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs text-gray-300"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span className="line-clamp-1">{feature}</span>
                            </div>
                          ))}
                        </div>

                        {/* Supply Info */}
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10 mb-4">
                          <div>
                            <div className="text-sm font-semibold text-white mb-1">
                              {property.availableTokens.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-400">
                              Available Tokens
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-white mb-1">
                              ${property.minInvestment.toLocaleString()}+
                            </div>
                            <div className="text-xs text-gray-400">Minimum</div>
                          </div>
                        </div>

                        {/* CTA Button */}
                        <motion.button
                          whileHover={
                            property.status === "live" ||
                            property.status === "funding"
                              ? { scale: 1.02 }
                              : {}
                          }
                          whileTap={
                            property.status === "live" ||
                            property.status === "funding"
                              ? { scale: 0.98 }
                              : {}
                          }
                          onClick={() => {
                            if (
                              property.status === "live" ||
                              property.status === "funding"
                            ) {
                              setSelectedProperty(property);
                              setPurchaseAmount(
                                property.minInvestment.toString(),
                              );
                              setShowPurchaseModal(true);
                            }
                          }}
                          disabled={property.status === "coming-soon"}
                          className={cn(
                            "w-full py-3 px-6 rounded-xl font-semibold transition-all duration-300",
                            property.status === "live" ||
                              property.status === "funding"
                              ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:shadow-lg hover:shadow-emerald-500/25 cursor-pointer"
                              : "bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed",
                          )}
                        >
                          <span className="flex items-center justify-center gap-2">
                            <DollarSign className="w-4 h-4" />
                            {property.status === "live"
                              ? "Purchase Tokens"
                              : property.status === "funding"
                                ? "Fund Property"
                                : "Coming Soon"}
                          </span>
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "holdings" && (
          <motion.div
            key="holdings"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {!isConnected ? (
              <EmptyState
                icon={Home}
                title="Connect Wallet"
                description="Connect your wallet to view your real estate holdings."
              />
            ) : !userHoldings || userHoldings.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No Holdings Yet"
                description="Purchase property tokens to start earning dividends."
              />
            ) : (
              <div className="space-y-4">
                {userHoldings.map((holding, index) => (
                  <motion.div
                    key={holding.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                          <Home className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-white">
                            {holding.propertyName}
                          </h3>
                          <div className="text-sm text-gray-400">
                            {holding.tokensOwned.toLocaleString()} tokens
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          ${holding.currentValue.toLocaleString()}
                        </div>
                        <div className="text-sm text-emerald-400">
                          +${holding.totalDividendsReceived.toLocaleString()}{" "}
                          dividends
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Purchase Date
                        </div>
                        <div className="text-sm text-white">
                          {new Date(holding.purchaseDate).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Average Price
                        </div>
                        <div className="text-sm text-white">
                          ${holding.averagePrice.toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Expected Yield
                        </div>
                        <div className="text-sm text-emerald-400">
                          {holding.expectedAnnualYield.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Last Dividend
                        </div>
                        <div className="text-sm text-white">
                          {new Date(
                            holding.lastDividendDate,
                          ).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "governance" && (
          <motion.div
            key="governance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {!isConnected ? (
              <EmptyState
                icon={Users}
                title="Connect Wallet"
                description="Connect your wallet to participate in governance."
              />
            ) : !governanceProposals || governanceProposals.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No Active Proposals"
                description="Check back later for governance proposals."
              />
            ) : (
              <div className="space-y-4">
                {governanceProposals.map((proposal, index) => (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              "px-2 py-1 rounded-lg text-xs font-medium",
                              proposal.status === "active"
                                ? "bg-blue-500/20 text-blue-400"
                                : proposal.status === "passed"
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : proposal.status === "rejected"
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-gray-500/20 text-gray-400",
                            )}
                          >
                            {proposal.status.toUpperCase()}
                          </div>
                          <div className="text-xs text-gray-400">
                            {proposal.proposalType.replace("_", " ")}
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">
                          {proposal.title}
                        </h3>
                        <p className="text-sm text-gray-300 mb-3">
                          {proposal.description}
                        </p>
                        <div className="text-xs text-gray-400">
                          Property: {proposal.propertyName}
                        </div>
                      </div>
                    </div>

                    {/* Voting Progress */}
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-emerald-400">
                          For: {proposal.votesFor.toLocaleString()}
                        </span>
                        <span className="text-red-400">
                          Against: {proposal.votesAgainst.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-3 bg-white/20 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 transition-all duration-500"
                          style={{
                            width: `${(proposal.votesFor / proposal.totalVotes) * 100}%`,
                          }}
                        />
                        <div
                          className="bg-red-500 transition-all duration-500"
                          style={{
                            width: `${(proposal.votesAgainst / proposal.totalVotes) * 100}%`,
                          }}
                        />
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Total Votes: {proposal.totalVotes.toLocaleString()}
                      </div>
                    </div>

                    {/* Voting Actions */}
                    {proposal.status === "active" && (
                      <div className="flex gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleVote(proposal.id, true)}
                          disabled={isProcessing}
                          className="flex-1 py-2 px-4 bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 rounded-xl hover:bg-emerald-500/30 transition-colors font-medium disabled:opacity-50"
                        >
                          Vote For
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => handleVote(proposal.id, false)}
                          disabled={isProcessing}
                          className="flex-1 py-2 px-4 bg-red-500/20 text-red-400 border border-red-400/30 rounded-xl hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50"
                        >
                          Vote Against
                        </motion.button>
                      </div>
                    )}

                    {/* Deadline */}
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          Voting deadline:{" "}
                          {new Date(proposal.votingDeadline).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Modal */}
      <AnimatePresence>
        {showPurchaseModal && selectedProperty && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowPurchaseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 max-w-md w-full border border-white/10 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-white">
                  Purchase Property Tokens
                </h3>
                <button
                  onClick={() => !isProcessing && setShowPurchaseModal(false)}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div className="p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-white">
                        {selectedProperty.name}
                      </div>
                      <div className="text-sm text-gray-400">
                        {selectedProperty.location}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-gray-400">Dividend Yield</div>
                      <div className="text-emerald-400 font-semibold">
                        {selectedProperty.expectedDividendYield.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400">Appreciation</div>
                      <div className="text-white font-semibold">
                        {selectedProperty.expectedAppreciation.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Investment Amount (USD)
                  </label>
                  <input
                    type="number"
                    value={purchaseAmount}
                    onChange={(e) => setPurchaseAmount(e.target.value)}
                    min={selectedProperty.minInvestment}
                    step="0.01"
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-emerald-400/50 transition-colors disabled:opacity-50"
                    placeholder={`Minimum: $${selectedProperty.minInvestment.toLocaleString()}`}
                  />
                </div>

                {purchaseAmount &&
                  parseFloat(purchaseAmount) >=
                    selectedProperty.minInvestment && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-400/30 rounded-xl">
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">
                            Tokens to receive:
                          </span>
                          <span className="text-white font-semibold">
                            {(
                              parseFloat(purchaseAmount) /
                              selectedProperty.pricePerToken
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">
                            Expected annual dividend:
                          </span>
                          <span className="text-emerald-400 font-semibold">
                            $
                            {(
                              (parseFloat(purchaseAmount) *
                                selectedProperty.expectedDividendYield) /
                              100
                            ).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-400">
                            Expected appreciation:
                          </span>
                          <span className="text-blue-400 font-semibold">
                            $
                            {(
                              (parseFloat(purchaseAmount) *
                                selectedProperty.expectedAppreciation) /
                              100
                            ).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                <div className="p-3 bg-amber-500/10 border border-amber-400/30 rounded-xl">
                  <p className="text-amber-300 text-sm">
                    ⚠️ Real estate investments are subject to market risks. Past
                    performance does not guarantee future results.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => !isProcessing && setShowPurchaseModal(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePurchase}
                  disabled={
                    isProcessing ||
                    !purchaseAmount ||
                    parseFloat(purchaseAmount) < selectedProperty.minInvestment
                  }
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    `Purchase $${parseFloat(purchaseAmount || "0").toLocaleString()}`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RealEstatePanel;
