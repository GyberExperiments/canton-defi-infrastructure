"use client";

import { useEffect, useState } from "react";
import {
    DamlIntegrationService,
    type AssetHoldingPayload,
    type Contract,
    type DamlIntegrationConfig,
    type InstitutionalAssetPayload,
} from "./damlIntegrationService";

export const useDamlIntegration = (config: DamlIntegrationConfig) => {
  const [service] = useState(() => new DamlIntegrationService(config));
  const [isConnected, setIsConnected] = useState(false);
  const [contracts, setContracts] = useState<{
    assets: Contract<InstitutionalAssetPayload>[];
    holdings: Contract<AssetHoldingPayload>[];
  }>({
    assets: [],
    holdings: [],
  });

  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      service.getInstitutionalAssets().then((assets) => {
        setContracts((prev) => ({ ...prev, assets }));
      });
    };

    const handleAssetCreated = (event: any) => {
      setContracts((prev) => ({
        ...prev,
        assets: [
          ...prev.assets,
          {
            templateId: event.contractId.templateId,
            contractId: event.contractId.contractId,
            payload: event.payload,
            signatories: [],
            observers: [],
            agreementText: "",
          },
        ],
      }));
    };

    service.on("connected", handleConnected);
    service.on("asset_created", handleAssetCreated);

    return () => {
      service.off("connected", handleConnected);
      service.off("asset_created", handleAssetCreated);
      service.removeAllListeners();
    };
  }, [service]);

  return {
    service,
    isConnected,
    contracts,
    createAsset: (assetData: Partial<InstitutionalAssetPayload>) =>
      service.createInstitutionalAsset(assetData),
    purchaseAsset: (
      assetId: string,
      investor: string,
      tokens: number,
      paymentData: any,
    ) => service.createPurchaseRequest(assetId, investor, tokens, paymentData),
    getUserHoldings: (investor: string) => service.getUserHoldings(investor),
  };
};
