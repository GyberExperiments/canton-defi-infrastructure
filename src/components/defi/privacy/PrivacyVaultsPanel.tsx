"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Plus,
  ArrowUpRight,
  Key,
  FileText,
  Users,
  Zap,
  X,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useAccount } from "wagmi";
import { toast } from "react-hot-toast";
import { cn } from "@/lib/utils";
import {
  usePrivacyVaultService,
  PrivacyVault as ServicePrivacyVault,
} from "@/lib/canton/services/privacyVaultService";
import { ProductCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

// Types
export interface PrivacyVault {
  id: string;
  name: string;
  description: string;
  owner: string;
  privacyLevel: "STANDARD" | "ENHANCED" | "MAXIMUM" | "QUANTUM_SAFE";
  encryptionStandard: string;
  zkProofProtocol: string;
  complianceLevel: string;
  multiSigThreshold: number;
  timelock: number;
  totalValue: number;
  assetCount: number;
  createdAt: string;
  status:
    | "INITIALIZING"
    | "ACTIVE"
    | "LOCKED"
    | "UNDER_AUDIT"
    | "MIGRATING"
    | "DEPRECATED";
}

export interface VaultAsset {
  id: string;
  vaultId: string;
  assetType: "CRYPTO" | "TOKEN" | "NFT" | "REAL_ASSET";
  assetId: string;
  amount: number;
  value: number;
  depositedAt: string;
  privacyScore: number;
}

export interface ComplianceProof {
  id: string;
  vaultId: string;
  proofType: "OWNERSHIP" | "BALANCE" | "COMPLIANCE";
  proofHash: string;
  verifiedAt: string;
  verifier: string;
  status: "verified" | "pending" | "rejected";
}

/** Map service PrivacyVault to local view model */
function mapServiceVaultToLocal(sv: ServicePrivacyVault): PrivacyVault {
  return {
    id: sv.id,
    name: sv.name,
    description: sv.description,
    owner: sv.owner,
    privacyLevel: sv.privacyLevel,
    encryptionStandard: sv.encryptionStandard,
    zkProofProtocol: sv.zkProofProtocol,
    complianceLevel: sv.complianceLevel,
    multiSigThreshold: sv.multiSigThreshold ?? 1,
    timelock: sv.timelock ?? 24,
    totalValue: Number(sv.totalValue),
    assetCount: sv.assetCount,
    createdAt:
      sv.createdAt instanceof Date
        ? sv.createdAt.toISOString()
        : String(sv.createdAt),
    status: sv.status,
  };
}

// Privacy Vaults Panel Component
export const PrivacyVaultsPanel: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedVault, setSelectedVault] = useState<PrivacyVault | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<"vaults" | "assets" | "proofs">(
    "vaults",
  );
  const [showVaultDetails, setShowVaultDetails] = useState(false);

  // Form state
  const [vaultName, setVaultName] = useState("");
  const [vaultDescription, setVaultDescription] = useState("");
  const [privacyLevel, setPrivacyLevel] = useState<
    "STANDARD" | "ENHANCED" | "MAXIMUM"
  >("ENHANCED");
  const [multiSigThreshold, setMultiSigThreshold] = useState(1);
  const [timelock, setTimelock] = useState(24);

  // Use Privacy Vault Service
  const {
    vaults: serviceVaults,
    isLoading,
    createVault,
    depositAsset,
    generateBalanceProof,
  } = usePrivacyVaultService();

  // Map service vaults to local view model
  const vaults: PrivacyVault[] = useMemo(
    () => (serviceVaults || []).map(mapServiceVaultToLocal),
    [serviceVaults],
  );

  // Local state for data not provided by the hook
  const [assets] = useState<VaultAsset[]>([]);
  const [proofs] = useState<ComplianceProof[]>([]);
  const [error, setError] = useState<Error | null>(null);

  const refreshData = async () => {
    // Refresh is handled by the service internally
  };

  const handleGenerateBalanceProof = async (
    vaultId: string,
    requester: string,
  ) => {
    const Decimal = (await import("decimal.js")).default;
    return generateBalanceProof(vaultId, new Decimal(0), requester);
  };

  // Calculate stats
  const vaultStats = useMemo(() => {
    if (!vaults || vaults.length === 0) {
      return {
        totalVaults: 0,
        totalValue: 0,
        totalAssets: 0,
        averagePrivacyScore: 0,
      };
    }

    const totalValue = vaults.reduce((sum, v) => sum + Number(v.totalValue), 0);
    const totalAssets = vaults.reduce((sum, v) => sum + v.assetCount, 0);
    const averagePrivacyScore =
      vaults.reduce((sum, v) => {
        const score =
          v.privacyLevel === "MAXIMUM"
            ? 100
            : v.privacyLevel === "ENHANCED"
              ? 75
              : 50;
        return sum + score;
      }, 0) / vaults.length;

    return {
      totalVaults: vaults.length,
      totalValue,
      totalAssets,
      averagePrivacyScore,
    };
  }, [vaults]);

  // Privacy level config
  const privacyConfig: Record<
    string,
    { label: string; color: string; bg: string; description: string }
  > = {
    STANDARD: {
      label: "Standard",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      description: "Basic privacy protection",
    },
    ENHANCED: {
      label: "Enhanced",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      description: "Advanced privacy with ZK proofs",
    },
    MAXIMUM: {
      label: "Maximum",
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      description: "Maximum privacy with multi-party auth",
    },
    QUANTUM_SAFE: {
      label: "Quantum Safe",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      description: "Post-quantum cryptography",
    },
  };

  // Status config matching VaultStatus from service
  const statusConfig: Record<
    string,
    { label: string; icon: typeof CheckCircle; className: string }
  > = {
    ACTIVE: {
      label: "Active",
      icon: CheckCircle,
      className: "bg-emerald-500/20 text-emerald-400 border-emerald-400/30",
    },
    LOCKED: {
      label: "Locked",
      icon: Lock,
      className: "bg-amber-500/20 text-amber-400 border-amber-400/30",
    },
    INITIALIZING: {
      label: "Initializing",
      icon: Clock,
      className: "bg-blue-500/20 text-blue-400 border-blue-400/30",
    },
    UNDER_AUDIT: {
      label: "Under Audit",
      icon: Eye,
      className: "bg-purple-500/20 text-purple-400 border-purple-400/30",
    },
    MIGRATING: {
      label: "Migrating",
      icon: Clock,
      className: "bg-orange-500/20 text-orange-400 border-orange-400/30",
    },
    DEPRECATED: {
      label: "Deprecated",
      icon: AlertCircle,
      className: "bg-red-500/20 text-red-400 border-red-400/30",
    },
  };

  // Handle vault creation
  const handleCreateVault = async () => {
    if (!address || !isConnected) {
      toast.error("Подключите кошелек для создания vault");
      return;
    }

    if (!vaultName.trim()) {
      toast.error("Введите название vault");
      return;
    }

    setIsProcessing(true);
    try {
      await createVault({
        name: vaultName,
        description: vaultDescription || "Private vault",
        owner: address,
        privacyLevel,
        encryptionStandard: "AES_256",
        zkProofProtocol: "GROTH16",
        complianceLevel: "ACCREDITED",
        multiSigThreshold,
        timelock,
      });

      toast.success("✅ Privacy vault создан успешно");
      setShowCreateModal(false);
      setVaultName("");
      setVaultDescription("");
      setPrivacyLevel("ENHANCED");
      setMultiSigThreshold(1);
      setTimelock(24);
      await refreshData();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Ошибка при создании vault";
      toast.error(`❌ ${errorMsg}`);
      console.error("Create vault error:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle proof generation
  const handleGenerateProof = async (
    vaultId: string,
    proofType: "OWNERSHIP" | "BALANCE" | "COMPLIANCE",
  ) => {
    if (!address || !isConnected) {
      toast.error("Подключите кошелек");
      return;
    }

    setIsProcessing(true);
    try {
      await handleGenerateBalanceProof(vaultId, address);

      toast.success("✅ ZK proof сгенерирован");
      await refreshData();
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Ошибка при генерации proof";
      toast.error(`❌ ${errorMsg}`);
      console.error("Generate proof error:", error);
    } finally {
      setIsProcessing(false);
    }
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
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500/20 to-indigo-500/20 rounded-full border border-purple-400/30 mb-6">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-purple-300 text-sm font-medium">
            Privacy-Preserving
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
            Institutional Privacy Vaults
          </span>
        </h2>
        <p className="text-xl text-gray-300 max-w-3xl mx-auto">
          Zero-Knowledge proofs for selective disclosure, multi-party
          authorization, and compliance without data exposure
        </p>
      </motion.div>

      {/* Stats */}
      {isConnected && vaults && vaults.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-6"
        >
          {[
            {
              label: "Total Vaults",
              value: vaultStats.totalVaults.toString(),
              icon: Shield,
              color: "text-purple-400",
            },
            {
              label: "Total Value",
              value: `$${(vaultStats.totalValue / 1000000).toFixed(1)}M`,
              icon: Lock,
              color: "text-cyan-400",
            },
            {
              label: "Total Assets",
              value: vaultStats.totalAssets.toString(),
              icon: Key,
              color: "text-emerald-400",
            },
            {
              label: "Avg Privacy Score",
              value: `${vaultStats.averagePrivacyScore.toFixed(0)}%`,
              icon: Eye,
              color: "text-blue-400",
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
            { id: "vaults", name: "Vaults", icon: Shield },
            { id: "assets", name: "Assets", icon: Key },
            { id: "proofs", name: "Proofs", icon: FileText },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all duration-300",
                activeTab === tab.id
                  ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg"
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
        {activeTab === "vaults" && (
          <motion.div
            key="vaults"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex justify-end mb-6">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                disabled={!isConnected}
                className={cn(
                  "flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-300",
                  isConnected
                    ? "bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-purple-500/25"
                    : "bg-white/5 text-gray-400 border border-white/10 cursor-not-allowed",
                )}
              >
                <Plus className="w-4 h-4" />
                Create Vault
              </motion.button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : !isConnected ? (
              <EmptyState
                icon={Shield}
                title="Connect Wallet"
                description="Connect your wallet to create and manage privacy vaults."
              />
            ) : !vaults || vaults.length === 0 ? (
              <EmptyState
                icon={Lock}
                title="No Vaults Yet"
                description="Create your first privacy vault to start protecting your assets."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {vaults.map((vault, index) => {
                  const privacyInfo = privacyConfig[vault.privacyLevel];
                  const statusInfo = statusConfig[vault.status];
                  const StatusIcon = statusInfo.icon;

                  return (
                    <motion.div
                      key={vault.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all duration-300 group"
                    >
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4 flex items-center gap-2">
                        <div
                          className={cn(
                            "w-2 h-2 rounded-full animate-pulse",
                            vault.status === "ACTIVE"
                              ? "bg-emerald-400"
                              : "bg-amber-400",
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

                      {/* Vault Icon */}
                      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        <Shield className="w-8 h-8 text-white" />
                      </div>

                      {/* Vault Info */}
                      <h3 className="text-xl font-bold text-white mb-2">
                        {vault.name}
                      </h3>
                      <p className="text-gray-300 text-sm mb-4 line-clamp-2">
                        {vault.description}
                      </p>

                      {/* Privacy Level */}
                      <div
                        className={cn(
                          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium mb-4",
                          privacyInfo.bg,
                        )}
                      >
                        <Eye className={cn("w-3.5 h-3.5", privacyInfo.color)} />
                        <span className={privacyInfo.color}>
                          {privacyInfo.label} Privacy
                        </span>
                      </div>

                      {/* Key Metrics */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-lg font-semibold text-white mb-1">
                            ${(Number(vault.totalValue) / 1000).toFixed(0)}K
                          </div>
                          <div className="text-xs text-gray-400">
                            Total Value
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-white mb-1">
                            {vault.assetCount}
                          </div>
                          <div className="text-xs text-gray-400">Assets</div>
                        </div>
                      </div>

                      {/* Features */}
                      <div className="space-y-1.5 mb-4">
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>ZK Proofs ({vault.zkProofProtocol})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Multi-Sig ({vault.multiSigThreshold}/3)</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-300">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          <span>Timelock: {vault.timelock}h</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedVault(vault);
                            setShowVaultDetails(true);
                          }}
                          className="flex-1 py-2 px-4 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors text-sm font-medium"
                        >
                          View Details
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() =>
                            handleGenerateProof(vault.id, "OWNERSHIP")
                          }
                          disabled={isProcessing}
                          className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:shadow-lg transition-all text-sm font-medium disabled:opacity-50"
                        >
                          Generate Proof
                        </motion.button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "assets" && (
          <motion.div
            key="assets"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {!isConnected ? (
              <EmptyState
                icon={Key}
                title="Connect Wallet"
                description="Connect your wallet to view your vault assets."
              />
            ) : !assets || assets.length === 0 ? (
              <EmptyState
                icon={Lock}
                title="No Assets Yet"
                description="Deposit assets to your vaults to start protecting them."
              />
            ) : (
              <div className="space-y-4">
                {assets.map((asset, index) => (
                  <motion.div
                    key={asset.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
                          <Key className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {asset.assetType}
                          </h3>
                          <div className="text-sm text-gray-400">
                            {asset.assetId}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white">
                          ${asset.value.toLocaleString()}
                        </div>
                        <div className="text-sm text-emerald-400">
                          Privacy Score: {asset.privacyScore}%
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Amount</div>
                        <div className="text-sm text-white">
                          {asset.amount.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Deposited
                        </div>
                        <div className="text-sm text-white">
                          {new Date(asset.depositedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Privacy Level
                        </div>
                        <div className="text-sm text-purple-400">
                          {asset.privacyScore >= 80
                            ? "Maximum"
                            : asset.privacyScore >= 60
                              ? "Enhanced"
                              : "Standard"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Status</div>
                        <div className="text-sm text-emerald-400">
                          Protected
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === "proofs" && (
          <motion.div
            key="proofs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {!isConnected ? (
              <EmptyState
                icon={FileText}
                title="Connect Wallet"
                description="Connect your wallet to view your compliance proofs."
              />
            ) : !proofs || proofs.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="No Proofs Yet"
                description="Generate ZK proofs to demonstrate compliance without revealing data."
              />
            ) : (
              <div className="space-y-4">
                {proofs.map((proof, index) => (
                  <motion.div
                    key={proof.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                          <FileText className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-white">
                            {proof.proofType} Proof
                          </h3>
                          <div className="text-sm text-gray-400">
                            {proof.proofHash.slice(0, 16)}...
                          </div>
                        </div>
                      </div>
                      <div
                        className={cn(
                          "px-3 py-1 rounded-full text-xs font-medium border",
                          proof.status === "verified"
                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-400/30"
                            : proof.status === "pending"
                              ? "bg-amber-500/20 text-amber-400 border-amber-400/30"
                              : "bg-red-500/20 text-red-400 border-red-400/30",
                        )}
                      >
                        {proof.status}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Verified At
                        </div>
                        <div className="text-sm text-white">
                          {new Date(proof.verifiedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Verifier
                        </div>
                        <div className="text-sm text-white">
                          {proof.verifier.slice(0, 8)}...
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">
                          Proof Hash
                        </div>
                        <div className="text-sm text-gray-300 font-mono text-xs">
                          {proof.proofHash.slice(0, 20)}...
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Status</div>
                        <div
                          className={cn(
                            "text-sm font-medium",
                            proof.status === "verified"
                              ? "text-emerald-400"
                              : proof.status === "pending"
                                ? "text-amber-400"
                                : "text-red-400",
                          )}
                        >
                          {proof.status.charAt(0).toUpperCase() +
                            proof.status.slice(1)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Vault Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => !isProcessing && setShowCreateModal(false)}
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
                  Create Privacy Vault
                </h3>
                <button
                  onClick={() => !isProcessing && setShowCreateModal(false)}
                  disabled={isProcessing}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Vault Name
                  </label>
                  <input
                    type="text"
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    disabled={isProcessing}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400/50 transition-colors disabled:opacity-50"
                    placeholder="My Private Vault"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Description
                  </label>
                  <textarea
                    value={vaultDescription}
                    onChange={(e) => setVaultDescription(e.target.value)}
                    disabled={isProcessing}
                    rows={3}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-400/50 transition-colors disabled:opacity-50 resize-none"
                    placeholder="Describe your vault's purpose..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Privacy Level
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(privacyConfig).map(([key, config]) => (
                      <motion.button
                        key={key}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setPrivacyLevel(key as any)}
                        className={cn(
                          "p-3 rounded-xl border transition-all duration-300 text-center",
                          privacyLevel === key
                            ? "bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border-purple-400/50 text-white"
                            : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10",
                        )}
                      >
                        <div className="text-sm font-semibold mb-1">
                          {config.label}
                        </div>
                        <div className="text-xs opacity-75">
                          {config.description}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Multi-Sig Threshold
                    </label>
                    <input
                      type="number"
                      value={multiSigThreshold}
                      onChange={(e) =>
                        setMultiSigThreshold(parseInt(e.target.value) || 1)
                      }
                      min={1}
                      max={3}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400/50 transition-colors disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Timelock (hours)
                    </label>
                    <input
                      type="number"
                      value={timelock}
                      onChange={(e) =>
                        setTimelock(parseInt(e.target.value) || 24)
                      }
                      min={1}
                      max={168}
                      disabled={isProcessing}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-400/50 transition-colors disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="p-3 bg-purple-500/10 border border-purple-400/30 rounded-xl">
                  <p className="text-purple-300 text-sm">
                    🔒 Your vault will use ZK proofs (
                    {privacyLevel === "MAXIMUM" ? "PLONK" : "GROTH16"}) for
                    privacy-preserving transactions.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => !isProcessing && setShowCreateModal(false)}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateVault}
                  disabled={isProcessing || !vaultName.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </span>
                  ) : (
                    "Create Vault"
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

export default PrivacyVaultsPanel;
