#!/usr/bin/env node

/**
 * 🔍 Intercom API Checker
 * Проверяет доступные API endpoints и возможности Fin
 */

const https = require('https');

const INTERCOM_CONFIG = {
  accessToken: process.env.INTERCOM_ACCESS_TOKEN,
  adminId: process.env.INTERCOM_ADMIN_ID,
  appId: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
  baseUrl: 'https://api.intercom.io'
};

async function makeIntercomRequest(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, INTERCOM_CONFIG.baseUrl);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${INTERCOM_CONFIG.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Intercom-Version': '2.8'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(responseData);
          resolve({
            status: res.statusCode,
            data: jsonData,
            headers: res.headers
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            data: responseData,
            headers: res.headers
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function checkIntercomAPI() {
  console.log('🔍 Проверяем Intercom API endpoints...\n');

  const endpoints = [
    { path: '/me', description: 'User info' },
    { path: '/admins', description: 'Admins list' },
    { path: '/conversations', description: 'Conversations' },
    { path: '/conversation_types', description: 'Conversation types' },
    { path: '/data_attributes', description: 'Data attributes' },
    { path: '/data_events', description: 'Data events' },
    { path: '/help_center', description: 'Help center' },
    { path: '/help_center/collections', description: 'Help center collections' },
    { path: '/help_center/sections', description: 'Help center sections' },
    { path: '/help_center/articles', description: 'Help center articles' },
    { path: '/visitors', description: 'Visitors' },
    { path: '/users', description: 'Users' },
    { path: '/contacts', description: 'Contacts' },
    { path: '/companies', description: 'Companies' },
    { path: '/tags', description: 'Tags' },
    { path: '/segments', description: 'Segments' },
    { path: '/teams', description: 'Teams' },
    { path: '/webhooks', description: 'Webhooks' },
    { path: '/apps', description: 'Apps' },
    { path: '/app', description: 'App info' },
    { path: '/fin', description: 'Fin assistant' },
    { path: '/fin/configuration', description: 'Fin configuration' },
    { path: '/fin/responses', description: 'Fin responses' },
    { path: '/fin/analytics', description: 'Fin analytics' },
    { path: '/bots', description: 'Bots' },
    { path: '/bots/configuration', description: 'Bots configuration' },
    { path: '/automation', description: 'Automation' },
    { path: '/automation/rules', description: 'Automation rules' },
    { path: '/automation/actions', description: 'Automation actions' }
  ];

  const results = [];

  for (const endpoint of endpoints) {
    try {
      const response = await makeIntercomRequest(endpoint.path);
      results.push({
        endpoint: endpoint.path,
        description: endpoint.description,
        status: response.status,
        success: response.status >= 200 && response.status < 300,
        data: response.data
      });
      
      const status = response.status >= 200 && response.status < 300 ? '✅' : '❌';
      console.log(`${status} ${endpoint.path} (${endpoint.description}): ${response.status}`);
      
      // Небольшая задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.push({
        endpoint: endpoint.path,
        description: endpoint.description,
        status: 'ERROR',
        success: false,
        error: error.message
      });
      console.log(`❌ ${endpoint.path} (${endpoint.description}): ERROR - ${error.message}`);
    }
  }

  console.log('\n📊 СВОДКА РЕЗУЛЬТАТОВ:');
  console.log('======================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Успешных запросов: ${successful.length}`);
  console.log(`❌ Неудачных запросов: ${failed.length}`);
  
  console.log('\n🎯 ДОСТУПНЫЕ ENDPOINTS:');
  successful.forEach(result => {
    console.log(`   ${result.endpoint} - ${result.description}`);
  });
  
  console.log('\n🚫 НЕДОСТУПНЫЕ ENDPOINTS:');
  failed.forEach(result => {
    console.log(`   ${result.endpoint} - ${result.description} (${result.status})`);
  });

  // Проверяем специфичные для Fin endpoints
  console.log('\n🤖 FIN-СПЕЦИФИЧНЫЕ ENDPOINTS:');
  const finEndpoints = results.filter(r => r.endpoint.includes('fin') || r.endpoint.includes('bot') || r.endpoint.includes('automation'));
  finEndpoints.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`   ${status} ${result.endpoint} - ${result.description}`);
  });

  // Проверяем возможности настройки
  console.log('\n⚙️ ВОЗМОЖНОСТИ НАСТРОЙКИ:');
  
  const hasWebhooks = results.find(r => r.endpoint === '/webhooks' && r.success);
  const hasTags = results.find(r => r.endpoint === '/tags' && r.success);
  const hasDataAttributes = results.find(r => r.endpoint === '/data_attributes' && r.success);
  const hasHelpCenter = results.find(r => r.endpoint === '/help_center' && r.success);
  const hasAutomation = results.find(r => r.endpoint === '/automation' && r.success);
  
  console.log(`   Webhooks: ${hasWebhooks ? '✅' : '❌'}`);
  console.log(`   Tags: ${hasTags ? '✅' : '❌'}`);
  console.log(`   Data Attributes: ${hasDataAttributes ? '✅' : '❌'}`);
  console.log(`   Help Center: ${hasHelpCenter ? '✅' : '❌'}`);
  console.log(`   Automation: ${hasAutomation ? '✅' : '❌'}`);

  return results;
}

async function main() {
  try {
    await checkIntercomAPI();
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkIntercomAPI };
