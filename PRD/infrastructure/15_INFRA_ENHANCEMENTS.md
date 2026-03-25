# 15 — Infrastructure Enhancements

## 1. Multi-Service Kubernetes Architecture

Current: 2 Next.js pods + standalone Docker containers
Target: Full K8s-native deployment with service mesh

```yaml
# Target Architecture
Namespace: canton-defi

Services:
  canton-otc-web:        # Next.js frontend (2-3 replicas)
    image: ghcr.io/gybernaty/canton-otc-web:v2
    ports: [3000]
    resources: { cpu: 200m-1000m, memory: 256Mi-1Gi }

  canton-api-server:     # Rust REST + gRPC API (2-3 replicas)
    image: ghcr.io/gybernaty/canton-api-server:v2
    ports: [8080 (HTTP), 50051 (gRPC)]
    resources: { cpu: 200m-1000m, memory: 128Mi-512Mi }

  canton-matching:       # Off-chain matching engine (1 replica, leader election)
    image: ghcr.io/gybernaty/canton-matching:v1
    ports: [8081]
    resources: { cpu: 500m-2000m, memory: 256Mi-1Gi }

  canton-oracle:         # Price feed aggregator (1 replica)
    image: ghcr.io/gybernaty/canton-oracle:v1
    ports: [8082]
    resources: { cpu: 100m-500m, memory: 128Mi-256Mi }

  redis:                 # Cache + pub/sub for real-time streaming
    image: redis:7-alpine
    ports: [6379]
    persistence: 1Gi PVC

Infrastructure:
  - Traefik Ingress (existing)
  - cert-manager (existing)
  - Prometheus + Grafana (existing, enhanced dashboards)
  - Loki (existing)
```

## 2. Enhanced CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  # 1. DAML contracts
  daml-build:
    steps:
      - daml build
      - daml test
      - Upload .dar artifact

  # 2. Rust SDK
  rust-check:
    steps:
      - cargo fmt --check
      - cargo clippy -- -D warnings
      - cargo test --workspace
      - cargo doc --no-deps

  rust-integration:
    needs: [daml-build]
    services:
      canton-sandbox: digitalasset/canton-open-source:2.9.3
    steps:
      - Upload DAR to sandbox
      - cargo test --features integration

  # 3. Frontend
  frontend-check:
    steps:
      - pnpm lint
      - pnpm type-check
      - pnpm test
      - pnpm build

  frontend-e2e:
    needs: [rust-integration]
    steps:
      - pnpm test:e2e

  # 4. Deploy (main only)
  deploy:
    needs: [daml-build, rust-integration, frontend-e2e]
    if: github.ref == 'refs/heads/main'
    steps:
      - Build & push all Docker images
      - kubectl apply manifests
      - Rollout wait
      - Health check
      - Smoke test (create order, query orderbook)
```

## 3. Observability Enhancements

### Grafana Dashboards

```
Dashboard: Canton DeFi Overview
  ├── Panel: Active Orders (gauge)
  ├── Panel: Orders/min (time series)
  ├── Panel: Match Rate (percentage)
  ├── Panel: Settlement Latency p50/p95/p99
  ├── Panel: Pool TVL (stacked area)
  ├── Panel: Oracle Price Feed (multi-line)
  ├── Panel: API Latency by endpoint
  ├── Panel: gRPC Error Rate
  ├── Panel: Circuit Breaker State
  └── Panel: Active WebSocket Connections

Dashboard: Canton Ledger Health
  ├── Panel: Ledger End Offset (counter)
  ├── Panel: ACS Contract Count by Template
  ├── Panel: Command Submission Latency
  ├── Panel: Transaction Processing Rate
  └── Panel: Connection Status (up/down)
```

### Structured Logging

```rust
// All services emit structured JSON logs
{
  "timestamp": "2026-02-24T12:00:00Z",
  "level": "INFO",
  "service": "canton-api-server",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Order matched",
  "fields": {
    "engine_id": "engine-cc-usdt",
    "buy_order_id": "buy-001",
    "sell_order_id": "sell-002",
    "fill_qty": 50.0,
    "fill_price": 0.77,
    "latency_ms": 45
  }
}
```

### Alerting Rules

```yaml
# Prometheus alerting rules
groups:
  - name: canton-defi
    rules:
      - alert: HighSettlementLatency
        expr: histogram_quantile(0.99, settlement_latency_seconds) > 5
        for: 5m

      - alert: MatchingEngineDown
        expr: up{job="canton-matching"} == 0
        for: 1m

      - alert: OracleStalePrice
        expr: time() - oracle_last_price_timestamp > 600
        for: 5m

      - alert: CircuitBreakerOpen
        expr: circuit_breaker_state == 1
        for: 30s

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 2m
```

## 4. Security Enhancements

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: canton-api-server-policy
spec:
  podSelector:
    matchLabels:
      app: canton-api-server
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: canton-otc-web    # Only frontend can reach API
      ports:
        - port: 8080
    - from:
        - podSelector:
            matchLabels:
              app: canton-matching   # Matching engine can reach API
      ports:
        - port: 50051              # gRPC only
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: redis
      ports:
        - port: 6379
    # Canton participant (external)
    - to: [{}]
      ports:
        - port: 5001
        - port: 5002
```

### Pod Security Standards
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop: [ALL]
```

## 5. Load Testing Infrastructure

```yaml
# k6 load test configuration
apiVersion: batch/v1
kind: Job
metadata:
  name: load-test
spec:
  template:
    spec:
      containers:
        - name: k6
          image: grafana/k6:latest
          command: ["k6", "run", "/scripts/defi-load-test.js"]
          env:
            - name: K6_VUS
              value: "100"
            - name: K6_DURATION
              value: "5m"
            - name: API_URL
              value: "http://canton-api-server:8080"
```
