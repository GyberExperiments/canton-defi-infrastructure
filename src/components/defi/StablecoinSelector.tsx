"use client";

/**
 * 🪙 Stablecoin Selector Component
 * Компонент для выбора стейблкоинов из разных сетей
 */

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  ChevronDown,
  Check,
  Coins,
  Zap,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getStablecoinDropdownOptions,
  STABLECOINS,
  type StablecoinConfig,
  type NetworkType,
} from "@/lib/canton/config/stablecoins";
import { useAccount, useBalance, useChainId } from "wagmi";
import { formatUnits } from "viem";

export interface StablecoinOption {
  value: string;
  label: string;
  icon: string;
  network: NetworkType;
  symbol: string;
}

interface StablecoinSelectorProps {
  selectedStablecoin: string | null;
  onSelect: (stablecoinKey: string, config: StablecoinConfig) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// Network badge colors
const NETWORK_COLORS: Partial<Record<NetworkType, string>> = {
  ETHEREUM: "bg-blue-500/20 text-blue-300 border-blue-400/30",
  BSC: "bg-yellow-500/20 text-yellow-300 border-yellow-400/30",
  POLYGON: "bg-purple-500/20 text-purple-300 border-purple-400/30",
  CANTON: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
};

// Network icons
const NETWORK_ICONS: Partial<Record<NetworkType, string>> = {
  ETHEREUM: "⟠",
  BSC: "🟡",
  POLYGON: "🟣",
  CANTON: "⚡",
};

export const StablecoinSelector: React.FC<StablecoinSelectorProps> = ({
  selectedStablecoin,
  onSelect,
  placeholder = "Выберите стейблкоин",
  disabled = false,
  className = "",
}) => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  // Map chainId to network type
  const currentNetwork = useMemo<NetworkType | null>(() => {
    if (chainId === 56) return "BSC";
    if (chainId === 1) return "ETHEREUM";
    if (chainId === 137) return "POLYGON";
    return null;
  }, [chainId]);

  // Convert STABLECOINS to StablecoinOption format with balance info
  const options: StablecoinOption[] = useMemo(() => {
    return STABLECOINS.flatMap((coin) =>
      coin.networks.map((network) => ({
        value: `${coin.symbol}_${network}`,
        label: `${coin.symbol} (${network})`,
        icon: coin.symbol,
        network,
        symbol: coin.symbol,
      })),
    );
  }, []);

  // Filter options by available networks (if network check is enabled)
  const availableOptions = useMemo(() => {
    // If connected, show only options for current network or all if network not detected
    if (isConnected && currentNetwork) {
      return options.filter((opt) => opt.network === currentNetwork);
    }
    return options;
  }, [options, isConnected, currentNetwork]);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get balance for a specific stablecoin
  const getStablecoinBalance = (symbol: string, network: NetworkType) => {
    const coin = STABLECOINS.find((c) => c.symbol === symbol);
    if (!coin || !address || !isConnected) return null;

    const addressForNetwork = coin.addresses[network];
    if (!addressForNetwork || addressForNetwork.startsWith("canton_"))
      return null;

    // This would require useBalance hook for each option, which is expensive
    // For now, return null and show balance only for selected option
    return null;
  };

  // Find selected option
  const selectedOption = options.find(
    (option) => option.value === selectedStablecoin,
  );

  // Get balance for selected stablecoin
  const selectedCoin = selectedOption
    ? STABLECOINS.find((c) => c.symbol === selectedOption.symbol)
    : null;
  const selectedTokenAddress =
    selectedCoin && selectedOption && currentNetwork
      ? (selectedCoin.addresses[currentNetwork] as `0x${string}` | undefined)
      : undefined;

  // @ts-expect-error wagmi v3 types don't expose 'token' but the runtime API supports it
  const { data: tokenBalance, isLoading: isLoadingBalance } = useBalance({
    address: address,
    token: selectedTokenAddress as `0x${string}` | undefined,
    query: {
      enabled:
        !!address && !!selectedTokenAddress && isConnected && !!currentNetwork,
    },
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: StablecoinOption) => {
    // Get full config from stablecoins config
    const config = STABLECOINS.find((coin) => coin.symbol === option.symbol);
    if (config) {
      onSelect(option.value, config);
    }
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Network Warning */}
      {isConnected && !currentNetwork && (
        <div className="mb-2 p-2 bg-amber-500/10 border border-amber-400/30 rounded-lg">
          <div className="flex items-center gap-2 text-amber-400 text-xs">
            <AlertTriangle className="w-3 h-3" />
            <span>
              Текущая сеть не поддерживается. Переключитесь на BSC, Ethereum или
              Polygon.
            </span>
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white transition-all duration-300",
          "hover:bg-white/8 hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400/50",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "border-blue-400/50 bg-white/8",
        )}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {selectedOption ? (
            <>
              {/* Network Icon */}
              <div
                className={cn(
                  "w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold border flex-shrink-0",
                  NETWORK_COLORS[selectedOption.network],
                )}
              >
                {NETWORK_ICONS[selectedOption.network]}
              </div>

              {/* Stablecoin Info */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Coins className="w-4 h-4 text-green-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {selectedOption.label}
                  </div>
                  {tokenBalance && isConnected && (
                    <div className="text-xs text-gray-400">
                      Balance:{" "}
                      {parseFloat(
                        formatUnits(
                          tokenBalance.value,
                          selectedCoin?.decimals || 18,
                        ),
                      ).toFixed(4)}{" "}
                      {selectedOption.symbol}
                    </div>
                  )}
                  {isLoadingBalance && (
                    <div className="text-xs text-gray-400 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Loading balance...
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Coins className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <span className="text-slate-400 truncate">{placeholder}</span>
            </>
          )}
        </div>

        <ChevronDown
          className={cn(
            "w-4 h-4 text-slate-400 transition-transform duration-200 flex-shrink-0",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50">
          <div className="backdrop-blur-xl bg-slate-900/95 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            <div className="p-2">
              <div className="text-xs text-slate-400 px-3 py-2 font-medium">
                Выберите стейблкоин для покупки CC
              </div>

              {/* Group by Network */}
              {(["BSC", "ETHEREUM", "POLYGON"] as NetworkType[]).map(
                (network) => {
                  const networkOptions = availableOptions.filter(
                    (option) => option.network === network,
                  );

                  if (networkOptions.length === 0) return null;

                  // Check if network is available
                  const isNetworkAvailable =
                    !isConnected ||
                    !currentNetwork ||
                    network === currentNetwork;

                  return (
                    <div key={network} className="mb-2 last:mb-0">
                      {/* Network Header */}
                      <div
                        className={cn(
                          "flex items-center justify-between gap-2 px-3 py-1 text-xs rounded-md mx-1 mb-1",
                          isNetworkAvailable
                            ? "text-slate-300 bg-white/3"
                            : "text-amber-400 bg-amber-500/10 border border-amber-400/20",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">
                            {NETWORK_ICONS[network]}
                          </span>
                          <span className="font-medium">{network} Network</span>
                        </div>
                        {!isNetworkAvailable && (
                          <span className="text-xs">Switch required</span>
                        )}
                      </div>

                      {/* Network Options */}
                      <div className="space-y-1">
                        {networkOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleSelect(option)}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 mx-1 rounded-md transition-all duration-200",
                              "hover:bg-white/8 text-left",
                              selectedStablecoin === option.value &&
                                "bg-blue-500/20 border-l-2 border-blue-400",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {/* Network Badge */}
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-sm flex items-center justify-center text-xs border",
                                  NETWORK_COLORS[option.network],
                                )}
                              >
                                {option.symbol === "USDT"
                                  ? "₮"
                                  : option.symbol === "USDC"
                                    ? "$"
                                    : "¤"}
                              </div>

                              {/* Stablecoin Info */}
                              <div>
                                <div className="text-sm font-medium text-white">
                                  {option.symbol}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {option.network} Network
                                </div>
                              </div>
                            </div>

                            {/* Selection Indicator */}
                            {selectedStablecoin === option.value && (
                              <Check className="w-4 h-4 text-blue-400" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                },
              )}

              {/* Feature Notice */}
              <div className="mt-3 pt-2 border-t border-white/10">
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-300 bg-amber-500/5 border border-amber-400/20 rounded-md">
                  <Zap className="w-3 h-3" />
                  <span>Покупка CC напрямую в Canton Network</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StablecoinSelector;
