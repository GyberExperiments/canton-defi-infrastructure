# 17 — gRPC Service Definitions

## Overview

gRPC services exposed by the Rust API server for SDK consumers and internal services. These complement the REST API for high-performance, typed communication.

**Port:** 50051
**Protocol:** HTTP/2 + Protobuf

---

## Proto Definitions

### defi_service.proto

```protobuf
syntax = "proto3";

package canton.defi.v1;

import "google/protobuf/timestamp.proto";

// ========== MATCHING ENGINE SERVICE ==========

service MatchingEngineService {
  // Place a new order
  rpc PlaceOrder (PlaceOrderRequest) returns (PlaceOrderResponse);

  // Cancel an existing order
  rpc CancelOrder (CancelOrderRequest) returns (CancelOrderResponse);

  // Get current orderbook snapshot
  rpc GetOrderbook (GetOrderbookRequest) returns (OrderbookSnapshot);

  // Stream orderbook updates (server-streaming)
  rpc StreamOrderbook (StreamOrderbookRequest) returns (stream OrderbookUpdate);

  // Stream trade events
  rpc StreamTrades (StreamTradesRequest) returns (stream TradeEvent);
}

message PlaceOrderRequest {
  string pair = 1;
  string side = 2;           // "buy" or "sell"
  string limit_price = 3;    // Decimal as string
  string quantity = 4;
  string min_fill_qty = 5;
  bool post_only = 6;
  optional int64 expires_in_seconds = 7;
}

message PlaceOrderResponse {
  string order_id = 1;
  string contract_id = 2;
  string status = 3;
  google.protobuf.Timestamp created_at = 4;
}

message CancelOrderRequest {
  string order_id = 1;
}

message CancelOrderResponse {
  bool cancelled = 1;
}

message GetOrderbookRequest {
  string pair = 1;
  int32 depth = 2;           // Number of price levels
}

message OrderbookSnapshot {
  string pair = 1;
  repeated PriceLevel bids = 2;
  repeated PriceLevel asks = 3;
  string spread = 4;
  string mid_price = 5;
  google.protobuf.Timestamp timestamp = 6;
}

message PriceLevel {
  string price = 1;
  string quantity = 2;
  int32 order_count = 3;
}

message StreamOrderbookRequest {
  string pair = 1;
}

message OrderbookUpdate {
  string type = 1;            // "snapshot", "update", "trade"
  optional OrderbookSnapshot snapshot = 2;
  optional PriceLevelUpdate delta = 3;
  optional TradeEvent trade = 4;
}

message PriceLevelUpdate {
  string side = 1;            // "bid" or "ask"
  string price = 2;
  string quantity = 3;        // "0" means remove level
}

message StreamTradesRequest {
  string pair = 1;
}

message TradeEvent {
  string fill_id = 1;
  string pair = 2;
  string price = 3;
  string quantity = 4;
  string side = 5;            // Taker side
  string maker_order_id = 6;
  string taker_order_id = 7;
  google.protobuf.Timestamp timestamp = 8;
}

// ========== LIQUIDITY POOL SERVICE ==========

service LiquidityPoolService {
  rpc GetPools (GetPoolsRequest) returns (GetPoolsResponse);
  rpc GetPool (GetPoolRequest) returns (PoolInfo);
  rpc AddLiquidity (AddLiquidityRequest) returns (AddLiquidityResponse);
  rpc RemoveLiquidity (RemoveLiquidityRequest) returns (RemoveLiquidityResponse);
  rpc SwapViaPool (SwapRequest) returns (SwapResponse);
  rpc StreamPoolUpdates (StreamPoolRequest) returns (stream PoolUpdate);
}

message GetPoolsRequest {}

message GetPoolsResponse {
  repeated PoolInfo pools = 1;
}

message GetPoolRequest {
  string pool_id = 1;
}

message PoolInfo {
  string pool_id = 1;
  string token_a = 2;
  string token_b = 3;
  string reserve_a = 4;
  string reserve_b = 5;
  string total_lp_tokens = 6;
  int32 fee_bps = 7;
  string tvl_usd = 8;
  string volume_24h = 9;
  string apy_24h = 10;
  string spot_price = 11;
}

message AddLiquidityRequest {
  string pool_id = 1;
  string amount_a = 2;
  string amount_b = 3;
  string min_lp_tokens = 4;   // Slippage protection
}

message AddLiquidityResponse {
  string lp_tokens_minted = 1;
  string actual_amount_a = 2;
  string actual_amount_b = 3;
  string pool_share_pct = 4;
}

message RemoveLiquidityRequest {
  string pool_id = 1;
  string lp_tokens = 2;
  string min_amount_a = 3;
  string min_amount_b = 4;
}

message RemoveLiquidityResponse {
  string amount_a = 1;
  string amount_b = 2;
}

message SwapRequest {
  string pool_id = 1;
  string direction = 2;       // "a_to_b" or "b_to_a"
  string amount_in = 3;
  string min_amount_out = 4;
}

message SwapResponse {
  string amount_in = 1;
  string amount_out = 2;
  string fee = 3;
  int32 price_impact_bps = 4;
  string executed_price = 5;
}

message StreamPoolRequest {
  string pool_id = 1;
}

message PoolUpdate {
  string pool_id = 1;
  string reserve_a = 2;
  string reserve_b = 3;
  string spot_price = 4;
  google.protobuf.Timestamp timestamp = 5;
}

// ========== PRICE ORACLE SERVICE ==========

service PriceOracleService {
  rpc GetPrice (GetPriceRequest) returns (PriceResponse);
  rpc GetPriceHistory (GetPriceHistoryRequest) returns (PriceHistoryResponse);
  rpc SubmitPrice (SubmitPriceRequest) returns (SubmitPriceResponse);
  rpc StreamPrices (StreamPricesRequest) returns (stream PriceUpdate);
}

message GetPriceRequest {
  string asset = 1;
}

message PriceResponse {
  string asset = 1;
  string price = 2;
  double confidence = 3;
  int32 sources = 4;
  string min_price = 5;
  string max_price = 6;
  google.protobuf.Timestamp timestamp = 7;
}

message GetPriceHistoryRequest {
  string asset = 1;
  string interval = 2;        // "1m", "5m", "15m", "1h", "4h", "1d"
  int32 limit = 3;
}

message PriceHistoryResponse {
  repeated Candle candles = 1;
}

message Candle {
  string open = 1;
  string high = 2;
  string low = 3;
  string close = 4;
  string volume = 5;
  google.protobuf.Timestamp timestamp = 6;
}

message SubmitPriceRequest {
  string asset = 1;
  string price = 2;
  double confidence = 3;
  string source = 4;
}

message SubmitPriceResponse {
  bool accepted = 1;
}

message StreamPricesRequest {
  repeated string assets = 1;
}

message PriceUpdate {
  string asset = 1;
  string price = 2;
  double confidence = 3;
  google.protobuf.Timestamp timestamp = 4;
}

// ========== PORTFOLIO SERVICE ==========

service PortfolioService {
  rpc GetPortfolio (GetPortfolioRequest) returns (PortfolioResponse);
  rpc StreamPortfolio (StreamPortfolioRequest) returns (stream PortfolioUpdate);
}

message GetPortfolioRequest {
  string party = 1;
}

message PortfolioResponse {
  repeated TokenBalance balances = 1;
  repeated LPPosition lp_positions = 2;
  repeated OrderSummary open_orders = 3;
  string total_value_usd = 4;
}

message TokenBalance {
  string asset = 1;
  string amount = 2;
  string value_usd = 3;
  string change_24h_pct = 4;
}

message LPPosition {
  string pool_id = 1;
  string lp_tokens = 2;
  string value_usd = 3;
  string share_pct = 4;
}

message OrderSummary {
  string order_id = 1;
  string pair = 2;
  string side = 3;
  string price = 4;
  string remaining_qty = 5;
  string status = 6;
}

message StreamPortfolioRequest {
  string party = 1;
}

message PortfolioUpdate {
  string type = 1;             // "balance", "order", "position", "settlement"
  optional TokenBalance balance = 2;
  optional OrderSummary order = 3;
  optional LPPosition position = 4;
}

// ========== COMPLIANCE SERVICE ==========

service ComplianceService {
  rpc CheckCompliance (CheckComplianceRequest) returns (CheckComplianceResponse);
  rpc RegisterAttestation (RegisterAttestationRequest) returns (RegisterAttestationResponse);
}

message CheckComplianceRequest {
  string party = 1;
}

message CheckComplianceResponse {
  bool approved = 1;
  string level = 2;
  string jurisdiction = 3;
  string reason = 4;
  google.protobuf.Timestamp expires_at = 5;
}

message RegisterAttestationRequest {
  string investor_party = 1;
  string level = 2;
  string jurisdiction = 3;
  string attestation_hash = 4;
  google.protobuf.Timestamp expires_at = 5;
}

message RegisterAttestationResponse {
  bool registered = 1;
}
```

---

## Rust Server Implementation Pattern

```rust
// canton-otc-api/src/grpc_server.rs

use tonic::{transport::Server, Request, Response, Status};

pub mod canton_defi_v1 {
    tonic::include_proto!("canton.defi.v1");
}

use canton_defi_v1::matching_engine_service_server::{
    MatchingEngineService, MatchingEngineServiceServer,
};

pub struct MatchingEngineGrpc {
    state: Arc<AppState>,
}

#[tonic::async_trait]
impl MatchingEngineService for MatchingEngineGrpc {
    async fn place_order(
        &self,
        request: Request<PlaceOrderRequest>,
    ) -> Result<Response<PlaceOrderResponse>, Status> {
        let req = request.into_inner();
        // Validate, build DAML command, submit
        // Same logic as REST handler but with proto types
        todo!()
    }

    type StreamOrderbookStream = ReceiverStream<Result<OrderbookUpdate, Status>>;

    async fn stream_orderbook(
        &self,
        request: Request<StreamOrderbookRequest>,
    ) -> Result<Response<Self::StreamOrderbookStream>, Status> {
        let (tx, rx) = mpsc::channel(128);
        // Subscribe to ACS changes for Order template
        // Push updates through channel
        tokio::spawn(async move {
            // Stream logic
        });
        Ok(Response::new(ReceiverStream::new(rx)))
    }
}
```

---

## Service Configuration

```yaml
# config/grpc.yaml
grpc:
  port: 50051
  max_connections: 1000
  keepalive_interval: 30s
  keepalive_timeout: 10s
  max_message_size: 4MB
  tls:
    enabled: true
    cert_path: /certs/server.pem
    key_path: /certs/server-key.pem
  reflection: true              # Enable gRPC reflection for debugging
```
