/**
 * 📊 PROMETHEUS METRICS FOR CANTON DEFI — PRODUCTION VERSION
 * 
 * Production monitoring and observability:
 * - Canton Network metrics
 * - Bridge transaction metrics
 * - ZK Proof generation metrics
 * - AI Optimizer metrics
 * - Error tracking and alerting
 * 
 * Основано на docs/prompts/archive/CANTON_DEFI_PRODUCTION_READINESS_PROMPT_V2.md
 */

// prom-client is optional (server-side only)
let Registry: any, Counter: any, Histogram: any, Gauge: any;

try {
  const promClient = require('prom-client');
  Registry = promClient.Registry;
  Counter = promClient.Counter;
  Histogram = promClient.Histogram;
  Gauge = promClient.Gauge;
} catch (error) {
  // prom-client not available (client-side or not installed)
  console.warn('⚠️ prom-client not available, using mock metrics');
  
  // Mock implementations for client-side
  class MockRegistry {
    register() { return this; }
  }
  class MockMetric {
    inc() {}
    set() {}
    observe() {}
    reset() {}
  }
  Registry = MockRegistry;
  Counter = MockMetric;
  Histogram = MockMetric;
  Gauge = MockMetric;
}

export const metricsRegistry = Registry ? new Registry() : ({} as any);

// ========================================
// CANTON NETWORK METRICS
// ========================================

export const cantonConnectionStatus = new Gauge({
  name: 'canton_connection_status',
  help: 'Canton Network connection status (1=connected, 0=disconnected)',
  registers: [metricsRegistry],
});

export const cantonTransactionDuration = new Histogram({
  name: 'canton_transaction_duration_seconds',
  help: 'Duration of Canton transactions',
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [metricsRegistry],
});

export const cantonTransactionErrors = new Counter({
  name: 'canton_transaction_errors_total',
  help: 'Total Canton transaction errors',
  labelNames: ['error_type'],
  registers: [metricsRegistry],
});

export const cantonActiveContracts = new Gauge({
  name: 'canton_active_contracts',
  help: 'Number of active DAML contracts',
  labelNames: ['template_id'],
  registers: [metricsRegistry],
});

// ========================================
// BRIDGE METRICS
// ========================================

export const bridgeDeposits = new Counter({
  name: 'bridge_deposits_total',
  help: 'Total bridge deposits',
  labelNames: ['token', 'chain'],
  registers: [metricsRegistry],
});

export const bridgeWithdrawals = new Counter({
  name: 'bridge_withdrawals_total',
  help: 'Total bridge withdrawals',
  labelNames: ['token', 'chain'],
  registers: [metricsRegistry],
});

export const bridgeVolume = new Gauge({
  name: 'bridge_volume_usd',
  help: 'Bridge volume in USD (24h)',
  labelNames: ['token', 'chain'],
  registers: [metricsRegistry],
});

export const bridgeTransactionDuration = new Histogram({
  name: 'bridge_transaction_duration_seconds',
  help: 'Bridge transaction completion time',
  buckets: [10, 30, 60, 120, 300, 600],
  labelNames: ['chain'],
  registers: [metricsRegistry],
});

export const bridgeErrors = new Counter({
  name: 'bridge_errors_total',
  help: 'Total bridge errors',
  labelNames: ['error_type', 'chain'],
  registers: [metricsRegistry],
});

// ========================================
// ZK PROOF METRICS
// ========================================

export const zkProofGenerationTime = new Histogram({
  name: 'zk_proof_generation_seconds',
  help: 'ZK proof generation time',
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  labelNames: ['circuit_type'],
  registers: [metricsRegistry],
});

export const zkProofVerificationTime = new Histogram({
  name: 'zk_proof_verification_seconds',
  help: 'ZK proof verification time',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
  labelNames: ['circuit_type'],
  registers: [metricsRegistry],
});

export const zkProofVerificationErrors = new Counter({
  name: 'zk_proof_verification_errors_total',
  help: 'Total ZK proof verification errors',
  labelNames: ['circuit_type', 'error_type'],
  registers: [metricsRegistry],
});

export const zkProofsGenerated = new Counter({
  name: 'zk_proofs_generated_total',
  help: 'Total ZK proofs generated',
  labelNames: ['circuit_type'],
  registers: [metricsRegistry],
});

// ========================================
// AI OPTIMIZER METRICS
// ========================================

export const aiOptimizerLatency = new Histogram({
  name: 'ai_optimizer_latency_seconds',
  help: 'AI optimizer API latency',
  buckets: [1, 2, 5, 10, 20, 30, 60],
  registers: [metricsRegistry],
});

export const aiOptimizerTokenUsage = new Counter({
  name: 'ai_optimizer_tokens_total',
  help: 'Total AI optimizer tokens used',
  registers: [metricsRegistry],
});

export const aiOptimizerErrors = new Counter({
  name: 'ai_optimizer_errors_total',
  help: 'Total AI optimizer errors',
  labelNames: ['error_type'],
  registers: [metricsRegistry],
});

export const aiOptimizerRequests = new Counter({
  name: 'ai_optimizer_requests_total',
  help: 'Total AI optimizer requests',
  labelNames: ['model'],
  registers: [metricsRegistry],
});

// ========================================
// DAML INTEGRATION METRICS
// ========================================

export const damlContractCreations = new Counter({
  name: 'daml_contract_creations_total',
  help: 'Total DAML contracts created',
  labelNames: ['template_id'],
  registers: [metricsRegistry],
});

export const damlChoiceExercises = new Counter({
  name: 'daml_choice_exercises_total',
  help: 'Total DAML choices exercised',
  labelNames: ['template_id', 'choice_name'],
  registers: [metricsRegistry],
});

export const damlQueryDuration = new Histogram({
  name: 'daml_query_duration_seconds',
  help: 'DAML query execution time',
  buckets: [0.1, 0.5, 1, 2, 5],
  labelNames: ['template_id'],
  registers: [metricsRegistry],
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Get metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  if (metricsRegistry && typeof metricsRegistry.metrics === 'function') {
    return await metricsRegistry.metrics();
  }
  return '';
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  if (metricsRegistry && typeof metricsRegistry.resetMetrics === 'function') {
    metricsRegistry.resetMetrics();
  }
}

/**
 * Register custom metric
 */
export function registerMetric(metric: typeof Counter | typeof Histogram | typeof Gauge): void {
  if (metricsRegistry && typeof metricsRegistry.registerMetric === 'function') {
    metricsRegistry.registerMetric(metric);
  }
}
