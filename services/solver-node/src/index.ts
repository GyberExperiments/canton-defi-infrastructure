/**
 * Solver Node - Main Entry Point
 * Автоматический исполнитель NEAR Intents
 */

import * as dotenv from 'dotenv'
import * as http from 'http'
import { createNearSigner } from './near-signer'
import { PriceOracle } from './price-oracle'
import { ProfitabilityCalculator } from './profitability'
import { IntentExecutor } from './executor'
import { IntentMonitor } from './intent-monitor'

// Загружаем environment variables
dotenv.config()

/**
 * Health check HTTP server для Kubernetes liveness/readiness probes
 */
function startHealthCheckServer(port: number = 8080): http.Server {
  const server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'solver-node',
        uptime: process.uptime()
      }))
    } else if (req.url === '/ready') {
      // Readiness probe - проверяет что сервис готов принимать трафик
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'ready',
        timestamp: new Date().toISOString()
      }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`🏥 Health check server listening on port ${port}`)
    console.log(`   Health endpoint: http://0.0.0.0:${port}/health`)
    console.log(`   Readiness endpoint: http://0.0.0.0:${port}/ready`)
  })

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${port} is already in use`)
      process.exit(1)
    } else {
      console.error('❌ Health check server error:', err)
    }
  })

  return server
}

/**
 * Инициализация и запуск Solver Node
 */
async function main() {
  console.log('🚀 Starting 1OTC Solver Node...')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Получаем конфигурацию из environment
  const network = (process.env.NEAR_NETWORK || 'testnet') as 'mainnet' | 'testnet'
  const contractId = process.env.NEAR_INTENTS_CONTRACT || 'verifier.testnet'
  const solverAccountId = process.env.SOLVER_ACCOUNT_ID
  const solverPrivateKey = process.env.SOLVER_PRIVATE_KEY

  if (!solverAccountId) {
    console.error('❌ SOLVER_ACCOUNT_ID is required')
    console.error('   Please set SOLVER_ACCOUNT_ID in .env file')
    process.exit(1)
  }

  if (!solverPrivateKey) {
    console.error('❌ SOLVER_PRIVATE_KEY is required')
    console.error('   Please set SOLVER_PRIVATE_KEY in .env file')
    console.error('   Format: ed25519:...')
    process.exit(1)
  }

  console.log('📋 Configuration:')
  console.log(`   Network: ${network}`)
  console.log(`   Contract: ${contractId}`)
  console.log(`   Solver Account: ${solverAccountId}`)
  console.log(`   Min Profit Threshold: ${process.env.SOLVER_MIN_PROFIT_THRESHOLD || '0.1'}`)
  console.log(`   Polling Interval: ${process.env.SOLVER_POLLING_INTERVAL || '2000'}ms`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // Запускаем health check сервер
  const healthCheckPort = parseInt(process.env.HEALTH_CHECK_PORT || '8080', 10)
  const healthServer = startHealthCheckServer(healthCheckPort)

  try {
    // Инициализируем компоненты
    console.log('🔧 Initializing components...')

    // Создаем и инициализируем NEAR signer
    console.log('🔐 Initializing NEAR Signer...')
    const signer = await createNearSigner({
      network,
      accountId: solverAccountId,
      privateKey: solverPrivateKey,
    })

    // Проверяем account info
    const accountInfo = await signer.getAccountInfo()
    if (accountInfo) {
      console.log('💰 Solver Account Info:', {
        balance: accountInfo.balance,
        storage: accountInfo.storage,
      })
    }

    const priceOracle = new PriceOracle()
    const profitabilityCalculator = new ProfitabilityCalculator(priceOracle)
    const executor = new IntentExecutor(network, contractId, solverAccountId, signer)
    const monitor = new IntentMonitor(
      network,
      contractId,
      solverAccountId,
      profitabilityCalculator,
      executor
    )

    console.log('✅ Components initialized')

    // Обрабатываем сигналы завершения
    process.on('SIGINT', () => {
      console.log('\n⏹️  Received SIGINT, shutting down gracefully...')
      monitor.stop()
      healthServer.close(() => {
        console.log('🏥 Health check server closed')
        process.exit(0)
      })
    })

    process.on('SIGTERM', () => {
      console.log('\n⏹️  Received SIGTERM, shutting down gracefully...')
      monitor.stop()
      process.exit(0)
    })

    // Запускаем мониторинг
    console.log('🎯 Starting intent monitoring...')
    await monitor.start()

  } catch (error: any) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

// Запускаем
main().catch(error => {
  console.error('❌ Unhandled error:', error)
  process.exit(1)
})

