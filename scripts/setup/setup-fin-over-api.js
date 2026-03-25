#!/usr/bin/env node

/**
 * 🤖 Fin over API Setup Script
 * Настройка Fin ассистента через Fin over API для Canton OTC
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

async function checkFinOverAPIAvailability() {
  console.log('🔍 Проверяем доступность Fin over API...\n');

  const finOverAPIEndpoints = [
    { path: '/fin_over_api', description: 'Fin over API main' },
    { path: '/fin_over_api/integrations', description: 'Fin over API integrations' },
    { path: '/fin_over_api/workflows', description: 'Fin over API workflows' },
    { path: '/fin_over_api/events', description: 'Fin over API events' },
    { path: '/custom_channels', description: 'Custom channels' },
    { path: '/custom_channels/events', description: 'Custom channel events' },
    { path: '/workflows', description: 'Workflows' },
    { path: '/workflows/triggers', description: 'Workflow triggers' },
    { path: '/workflows/actions', description: 'Workflow actions' },
    { path: '/workflows/steps', description: 'Workflow steps' }
  ];

  const results = [];

  for (const endpoint of finOverAPIEndpoints) {
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
      
      // Показываем детали для успешных запросов
      if (response.status >= 200 && response.status < 300 && response.data) {
        if (Array.isArray(response.data)) {
          console.log(`   📊 Найдено элементов: ${response.data.length}`);
        } else if (typeof response.data === 'object') {
          console.log(`   📋 Ключи: ${Object.keys(response.data).join(', ')}`);
        }
      }
      
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

  console.log('\n📊 РЕЗУЛЬТАТЫ ПРОВЕРКИ FIN OVER API:');
  console.log('=====================================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Доступных endpoints: ${successful.length}`);
  console.log(`❌ Недоступных endpoints: ${failed.length}`);
  
  if (successful.length > 0) {
    console.log('\n🎯 ДОСТУПНЫЕ FIN OVER API ENDPOINTS:');
    successful.forEach(result => {
      console.log(`   ${result.endpoint} - ${result.description}`);
    });
  }

  return results;
}

async function setupCustomChannelIntegration() {
  console.log('\n🔗 Настраиваем Custom Channel Integration...\n');

  // Проверяем существующие интеграции
  try {
    const existingIntegrations = await makeIntercomRequest('/custom_channels');
    console.log('📋 Существующие интеграции:');
    if (existingIntegrations.data && Array.isArray(existingIntegrations.data)) {
      existingIntegrations.data.forEach(integration => {
        console.log(`   - ${integration.name || integration.id}: ${integration.status || 'unknown'}`);
      });
    } else {
      console.log('   Нет существующих интеграций');
    }
  } catch (error) {
    console.log('⚠️ Не удалось получить список интеграций:', error.message);
  }

  // Создаем новую интеграцию для Canton OTC
  const integrationData = {
    name: 'Canton OTC Fin Integration',
    description: 'AI Assistant for Canton Coin trading via Fin over API',
    callback_url: 'https://stage.minimal.build.infra.1otc.cc/api/intercom/fin-over-api',
    authentication_token: process.env.INTERCOM_WEBHOOK_SECRET,
    settings: {
      auto_reply: true,
      collect_user_data: true,
      handoff_to_human: true
    }
  };

  try {
    console.log('🚀 Создаем новую интеграцию...');
    const createResponse = await makeIntercomRequest('/custom_channels', 'POST', integrationData);
    
    if (createResponse.status === 200 || createResponse.status === 201) {
      console.log('✅ Интеграция создана успешно!');
      console.log('📋 Детали интеграции:');
      console.log(`   ID: ${createResponse.data.id}`);
      console.log(`   Name: ${createResponse.data.name}`);
      console.log(`   Status: ${createResponse.data.status}`);
      console.log(`   Callback URL: ${createResponse.data.callback_url}`);
      return createResponse.data;
    } else {
      console.log('❌ Ошибка создания интеграции:', createResponse.status, createResponse.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка при создании интеграции:', error.message);
    return null;
  }
}

async function setupFinWorkflow() {
  console.log('\n🔄 Настраиваем Fin Workflow...\n');

  // Создаем workflow для Canton OTC
  const workflowData = {
    name: 'Canton OTC Fin Workflow',
    description: 'Automated workflow for Canton Coin trading support',
    trigger: {
      type: 'conversation_started',
      conditions: {
        channel: 'custom_channel'
      }
    },
    steps: [
      {
        type: 'let_fin_answer',
        name: 'Let Fin Answer',
        settings: {
          knowledge_base: 'canton_coin_knowledge',
          fallback_action: 'handoff_to_human'
        }
      },
      {
        type: 'collect_data',
        name: 'Collect Order Data',
        settings: {
          fields: [
            { name: 'amount', type: 'number', required: true },
            { name: 'network', type: 'text', required: true },
            { name: 'canton_address', type: 'text', required: true },
            { name: 'email', type: 'email', required: true }
          ]
        }
      },
      {
        type: 'create_order',
        name: 'Create Order',
        settings: {
          api_endpoint: 'https://stage.minimal.build.infra.1otc.cc/api/intercom/ai-agent',
          order_template: 'canton_otc_order'
        }
      }
    ]
  };

  try {
    console.log('🚀 Создаем Fin Workflow...');
    const workflowResponse = await makeIntercomRequest('/workflows', 'POST', workflowData);
    
    if (workflowResponse.status === 200 || workflowResponse.status === 201) {
      console.log('✅ Workflow создан успешно!');
      console.log('📋 Детали workflow:');
      console.log(`   ID: ${workflowResponse.data.id}`);
      console.log(`   Name: ${workflowResponse.data.name}`);
      console.log(`   Status: ${workflowResponse.data.status}`);
      console.log(`   Steps: ${workflowResponse.data.steps?.length || 0}`);
      return workflowResponse.data;
    } else {
      console.log('❌ Ошибка создания workflow:', workflowResponse.status, workflowResponse.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка при создании workflow:', error.message);
    return null;
  }
}

async function testFinOverAPIIntegration() {
  console.log('\n🧪 Тестируем Fin over API интеграцию...\n');

  // Тест 1: Отправка события new_conversation
  console.log('1️⃣ Тестируем new_conversation событие...');
  try {
    const conversationEvent = {
      event_type: 'new_conversation',
      external_conversation_id: 'test-conversation-' + Date.now(),
      user: {
        external_id: 'test-user-' + Date.now(),
        email: 'test@canton-otc.com',
        name: 'Test User'
      },
      metadata: {
        source: 'canton_otc_website',
        order_context: 'canton_coin_purchase'
      }
    };

    const eventResponse = await makeIntercomRequest('/custom_channels/events', 'POST', conversationEvent);
    
    if (eventResponse.status === 200 || eventResponse.status === 201) {
      console.log('✅ new_conversation событие отправлено успешно');
    } else {
      console.log('❌ Ошибка отправки события:', eventResponse.status, eventResponse.data);
    }
  } catch (error) {
    console.log('❌ Ошибка при отправке события:', error.message);
  }

  // Тест 2: Отправка события new_message
  console.log('\n2️⃣ Тестируем new_message событие...');
  try {
    const messageEvent = {
      event_type: 'new_message',
      external_conversation_id: 'test-conversation-' + Date.now(),
      message: {
        type: 'text',
        text: 'Хочу купить Canton Coin на $100 USDT TRC-20'
      },
      user: {
        external_id: 'test-user-' + Date.now(),
        email: 'buyer@canton-otc.com'
      }
    };

    const messageResponse = await makeIntercomRequest('/custom_channels/events', 'POST', messageEvent);
    
    if (messageResponse.status === 200 || messageResponse.status === 201) {
      console.log('✅ new_message событие отправлено успешно');
    } else {
      console.log('❌ Ошибка отправки сообщения:', messageResponse.status, messageResponse.data);
    }
  } catch (error) {
    console.log('❌ Ошибка при отправке сообщения:', error.message);
  }
}

async function main() {
  console.log('🚀 Запуск настройки Fin over API для Canton OTC...\n');
  
  try {
    // 1. Проверяем доступность Fin over API
    const apiResults = await checkFinOverAPIAvailability();
    
    // 2. Если API доступен, настраиваем интеграцию
    const hasFinOverAPI = apiResults.some(r => r.endpoint.includes('fin_over_api') || r.endpoint.includes('custom_channels'));
    
    if (hasFinOverAPI) {
      console.log('\n🎉 Fin over API доступен! Настраиваем интеграцию...\n');
      
      // Настраиваем Custom Channel Integration
      const integration = await setupCustomChannelIntegration();
      
      if (integration) {
        // Настраиваем Fin Workflow
        const workflow = await setupFinWorkflow();
        
        if (workflow) {
          // Тестируем интеграцию
          await testFinOverAPIIntegration();
          
          console.log('\n🎉 Fin over API настроен успешно!');
          console.log('\n📋 СЛЕДУЮЩИЕ ШАГИ:');
          console.log('1. Создайте endpoint /api/intercom/fin-over-api для обработки событий');
          console.log('2. Настройте обработку входящих событий от Fin');
          console.log('3. Протестируйте интеграцию с реальными клиентами');
        }
      }
    } else {
      console.log('\n⚠️ Fin over API недоступен в вашем аккаунте Intercom');
      console.log('\n📞 КОНТАКТ ДЛЯ АКТИВАЦИИ:');
      console.log('Свяжитесь с командой Intercom для активации функции "Fin over API"');
      console.log('Email: support@intercom.com');
      console.log('Укажите: "Request for Fin over API access for Canton OTC project"');
      
      console.log('\n🔄 АЛЬТЕРНАТИВНЫЙ ПЛАН:');
      console.log('1. Используйте стандартный Fin ассистент через веб-интерфейс');
      console.log('2. Настройте webhook интеграцию с нашим AI агентом');
      console.log('3. Используйте созданные конфигурации из fin-assistant-config.md');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkFinOverAPIAvailability,
  setupCustomChannelIntegration,
  setupFinWorkflow,
  testFinOverAPIIntegration
};
