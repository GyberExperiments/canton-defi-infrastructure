# 14 — Existing Infrastructure

## Production Deployment

### Kubernetes Cluster (65.108.15.30)

```yaml
# Namespace: canton-otc
# Deployment: 2 replicas, RollingUpdate
# Image: ghcr.io/themacroeconomicdao/cantonotc:main
# Resources per pod:
#   CPU: 100m request / 500m limit
#   Memory: 256Mi request / 512Mi limit
# Health checks:
#   Liveness: GET /api/health (60s delay, 15s interval, 5 failures)
#   Readiness: GET /api/health (30s delay, 10s interval, 5 failures)

Components:
  - 2x Next.js pods (cantonotc:main)
  - 1x Canton Participant Node (Docker, ports 5011/5012)
  - 1x Rust API Server (canton-api-server, port 8080)
  - 1x Redis (rate limiting, cache)
  - Traefik Ingress Controller
  - cert-manager (Let's Encrypt SSL)
  - DevNet SNAT Fix DaemonSet (21 domain resolution, iptables rules)
```

### CI/CD Pipeline

```
Push to main → GitHub Actions:
  1. Checkout (recursive submodules)
  2. Docker build (3-stage: deps → build → runtime)
  3. Push to ghcr.io
  4. kubectl: update secrets (50+ vars, base64 encoded)
  5. kubectl: update deployment image
  6. Rollout wait (180s timeout)
  7. Verify pods + health check curl

Separate workflow for Rust API server:
  Trigger: changes to crates/canton-otc-api/**
  Build & push: ghcr.io/themacroeconomicdao/canton-api-server
```

### Monitoring Stack (Available)

```
Prometheus + Grafana    → Metrics & dashboards
Loki                    → Log aggregation
Velero                  → Disaster recovery
Redis Sentinel          → HA cache
HPA + PDB              → Auto-scaling + disruption budget
```

### Secrets Management

```
GitHub Secrets (50+ vars)
  → base64 encode
  → envsubst into secret.template.yaml
  → kubectl apply
  → K8s Secret (canton-otc-secrets)
  → Container env vars
```

### Docker Build

```dockerfile
# 3-stage build:
# Stage 1: node:20-slim + pnpm + native deps
# Stage 2: pnpm build (NODE_OPTIONS=--max-old-space-size=4096)
# Stage 3: Non-root user (UID 1001), .next/standalone
# Exposes: 3000
```

### Local Development

```yaml
# docker-compose.local-test.yml
canton-sandbox:    digitalasset/canton-open-source:2.7.9 (ports 5011, 5012)
daml-deploy:       digitalasset/daml-sdk:2.7.9 (builds & uploads DARs)
canton-otc-api:    Rust API (port 8080)
```

### Scripts (40+)

```
scripts/
├── deployment/     # deploy-to-main.sh, monitor-deployment.sh, backup-critical-data.sh
├── testing/        # 18 test scripts (full-system, endpoints, order flows)
├── k8s-ops/        # 40+ cluster management scripts
├── security/       # security-audit.sh, scan-malware.sh, check-react-vulnerabilities.sh
└── telegram/       # Bot setup and verification
```

### Network

```
Public: https://1otc.cc → 45.9.41.209 (K8s LoadBalancer)
SSL: cert-manager + Let's Encrypt (auto-renewal)
Canton: participant.validator.svc.cluster.local:5001 (internal)
Rust API: canton-otc-api:8080 (internal)
```
