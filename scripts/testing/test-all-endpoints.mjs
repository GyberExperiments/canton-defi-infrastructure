#!/usr/bin/env node
/**
 * 🧪 Comprehensive API Endpoints Testing Script
 * Тестирование всех API endpoints Canton OTC
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@example.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'test123';

// ANSI Colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: (msg) => console.log(`\n${colors.bright}${colors.cyan}━━━ ${msg} ━━━${colors.reset}\n`),
};

let testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
};

/**
 * Тестирование одного endpoint
 */
async function testEndpoint(name, method, path, options = {}) {
  testResults.total++;
  
  const {
    expectedStatus = 200,
    skipAuth = false,
    requireAuth = false,
    body = null,
    headers = {},
    shouldFail = false,
  } = options;

  try {
    const url = `${BASE_URL}${path}`;
    const requestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      requestOptions.body = JSON.stringify(body);
    }

    log.info(`Testing ${method} ${path}...`);
    
    const response = await fetch(url, requestOptions);
    const data = await response.json().catch(() => ({}));

    const statusMatch = response.status === expectedStatus;
    
    if (shouldFail && !statusMatch) {
      testResults.passed++;
      log.success(`${name} - Expected failure confirmed (${response.status})`);
      return { success: true, status: response.status, data };
    }

    if (statusMatch) {
      testResults.passed++;
      log.success(`${name} - Status ${response.status} ✓`);
      
      if (data && Object.keys(data).length > 0) {
        console.log(`  Response preview:`, JSON.stringify(data).substring(0, 200) + '...');
      }
      
      return { success: true, status: response.status, data };
    } else {
      testResults.failed++;
      log.error(`${name} - Expected ${expectedStatus}, got ${response.status}`);
      console.log(`  Error:`, data);
      return { success: false, status: response.status, data };
    }
  } catch (error) {
    testResults.failed++;
    log.error(`${name} - ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Основной тест-раннер
 */
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}
╔═══════════════════════════════════════════════════════╗
║         Canton OTC API Endpoints Test Suite          ║
╚═══════════════════════════════════════════════════════╝
${colors.reset}`);

  log.info(`Base URL: ${BASE_URL}`);
  log.info(`Starting comprehensive API tests...\n`);

  // ═══════════════════════════════════════════════════════════
  // 1. PUBLIC ENDPOINTS
  // ═══════════════════════════════════════════════════════════
  log.section('PUBLIC ENDPOINTS');

  await testEndpoint(
    'Health Check',
    'GET',
    '/api/health',
    { expectedStatus: 200 }
  );

  await testEndpoint(
    'Config - Get Current',
    'GET',
    '/api/config',
    { expectedStatus: 200 }
  );

  await testEndpoint(
    'Config - Check Updates',
    'GET',
    '/api/config/check-updates',
    { expectedStatus: 200 }
  );

  // ═══════════════════════════════════════════════════════════
  // 2. ORDER ENDPOINTS (PUBLIC)
  // ═══════════════════════════════════════════════════════════
  log.section('ORDER ENDPOINTS (PUBLIC)');

  const testOrderId = 'TEST-' + Date.now().toString(36).toUpperCase();
  
  await testEndpoint(
    'Create Order',
    'POST',
    '/api/create-order',
    {
      expectedStatus: 200,
      body: {
        fromToken: 'USDT',
        fromNetwork: 'BSC',
        toToken: 'CANTON',
        fromAmount: 100,
        email: 'test@example.com',
        cantonAddress: '0x' + '1'.repeat(40),
      }
    }
  );

  await testEndpoint(
    'Order Status - Not Found',
    'GET',
    '/api/order-status/NONEXISTENT',
    { expectedStatus: 404, shouldFail: true }
  );

  // ═══════════════════════════════════════════════════════════
  // 3. ADMIN ENDPOINTS (Requires Auth)
  // ═══════════════════════════════════════════════════════════
  log.section('ADMIN ENDPOINTS (Protected)');

  await testEndpoint(
    'Admin Stats - Unauthorized',
    'GET',
    '/api/admin/stats',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Orders - Unauthorized',
    'GET',
    '/api/admin/orders',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Customers - Unauthorized',
    'GET',
    '/api/admin/customers',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Customers Analytics - Unauthorized',
    'GET',
    '/api/admin/customers/analytics',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Settings - Unauthorized',
    'GET',
    '/api/admin/settings',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Monitoring - Unauthorized',
    'GET',
    '/api/admin/monitoring',
    { expectedStatus: 401, shouldFail: true }
  );

  await testEndpoint(
    'Admin Rate Limit - Unauthorized',
    'GET',
    '/api/admin/rate-limit',
    { expectedStatus: 401, shouldFail: true }
  );

  // ═══════════════════════════════════════════════════════════
  // 4. TELEGRAM MEDIATOR ENDPOINTS
  // ═══════════════════════════════════════════════════════════
  log.section('TELEGRAM MEDIATOR ENDPOINTS');

  await testEndpoint(
    'Telegram Mediator Status',
    'GET',
    '/api/telegram-mediator/status',
    { expectedStatus: 200 }
  );

  // ═══════════════════════════════════════════════════════════
  // 5. INTERCOM ENDPOINTS
  // ═══════════════════════════════════════════════════════════
  log.section('INTERCOM ENDPOINTS');

  await testEndpoint(
    'Intercom Generate JWT',
    'POST',
    '/api/intercom/generate-jwt',
    {
      expectedStatus: 200,
      body: {
        email: 'test@example.com',
        name: 'Test User'
      }
    }
  );

  // ═══════════════════════════════════════════════════════════
  // RESULTS SUMMARY
  // ═══════════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  console.log(`${colors.bright}Test Results Summary:${colors.reset}`);
  console.log(`  Total Tests:  ${testResults.total}`);
  console.log(`  ${colors.green}✓ Passed:     ${testResults.passed}${colors.reset}`);
  console.log(`  ${colors.red}✗ Failed:     ${testResults.failed}${colors.reset}`);
  console.log(`  ${colors.yellow}⊘ Skipped:    ${testResults.skipped}${colors.reset}`);
  
  const passRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(`\n  Pass Rate:    ${passRate >= 80 ? colors.green : colors.red}${passRate}%${colors.reset}`);

  console.log(`\n${colors.bright}${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Запуск тестов
runTests().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

