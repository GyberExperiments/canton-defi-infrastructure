#!/usr/bin/env node

/**
 * 🤖 Fin Standard API Setup Script
 * Настройка Fin ассистента через стандартные API endpoints Intercom
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

async function checkFinStandardAPI() {
  console.log('🔍 Проверяем стандартные Fin API endpoints...\n');

  const standardEndpoints = [
    { path: '/help_center/collections', description: 'Help center collections' },
    { path: '/help_center/sections', description: 'Help center sections' },
    { path: '/help_center/articles', description: 'Help center articles' },
    { path: '/data_attributes', description: 'Data attributes' },
    { path: '/tags', description: 'Tags' },
    { path: '/segments', description: 'Segments' },
    { path: '/teams', description: 'Teams' },
    { path: '/admins', description: 'Admins' },
    { path: '/conversations', description: 'Conversations' },
    { path: '/contacts', description: 'Contacts' },
    { path: '/companies', description: 'Companies' }
  ];

  const results = [];

  for (const endpoint of standardEndpoints) {
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

  return results;
}

async function createHelpCenterContent() {
  console.log('\n📚 Создаем контент для Help Center (база знаний Fin)...\n');

  // 1. Создаем коллекцию для Canton Coin
  const collectionData = {
    name: 'Canton Coin Trading',
    description: 'Everything about buying and selling Canton Coin (CC)',
    translated_content: {
      en: {
        name: 'Canton Coin Trading',
        description: 'Everything about buying and selling Canton Coin (CC)'
      },
      ru: {
        name: 'Торговля Canton Coin',
        description: 'Все о покупке и продаже Canton Coin (CC)'
      }
    }
  };

  try {
    console.log('🚀 Создаем коллекцию Canton Coin...');
    const collectionResponse = await makeIntercomRequest('/help_center/collections', 'POST', collectionData);
    
    if (collectionResponse.status === 200 || collectionResponse.status === 201) {
      console.log('✅ Коллекция создана успешно!');
      console.log(`   ID: ${collectionResponse.data.id}`);
      console.log(`   Name: ${collectionResponse.data.name}`);
      
      const collectionId = collectionResponse.data.id;
      
      // 2. Создаем секции
      const sections = [
        {
          name: 'Buying Canton Coin',
          description: 'How to buy Canton Coin',
          collection_id: collectionId,
          translated_content: {
            en: {
              name: 'Buying Canton Coin',
              description: 'How to buy Canton Coin'
            },
            ru: {
              name: 'Покупка Canton Coin',
              description: 'Как купить Canton Coin'
            }
          }
        },
        {
          name: 'Pricing and Networks',
          description: 'Current prices and supported networks',
          collection_id: collectionId,
          translated_content: {
            en: {
              name: 'Pricing and Networks',
              description: 'Current prices and supported networks'
            },
            ru: {
              name: 'Цены и сети',
              description: 'Текущие цены и поддерживаемые сети'
            }
          }
        },
        {
          name: 'Order Management',
          description: 'Managing your orders',
          collection_id: collectionId,
          translated_content: {
            en: {
              name: 'Order Management',
              description: 'Managing your orders'
            },
            ru: {
              name: 'Управление заказами',
              description: 'Управление вашими заказами'
            }
          }
        }
      ];

      for (const sectionData of sections) {
        try {
          const sectionResponse = await makeIntercomRequest('/help_center/sections', 'POST', sectionData);
          if (sectionResponse.status === 200 || sectionResponse.status === 201) {
            console.log(`✅ Секция создана: ${sectionData.name}`);
            
            // 3. Создаем статьи для каждой секции
            const articles = getArticlesForSection(sectionData.name, sectionResponse.data.id);
            
            for (const articleData of articles) {
              try {
                const articleResponse = await makeIntercomRequest('/help_center/articles', 'POST', articleData);
                if (articleResponse.status === 200 || articleResponse.status === 201) {
                  console.log(`   ✅ Статья создана: ${articleData.title}`);
                } else {
                  console.log(`   ❌ Ошибка создания статьи: ${articleResponse.status}`);
                }
              } catch (error) {
                console.log(`   ❌ Ошибка при создании статьи: ${error.message}`);
              }
            }
          } else {
            console.log(`❌ Ошибка создания секции: ${sectionResponse.status}`);
          }
        } catch (error) {
          console.log(`❌ Ошибка при создании секции: ${error.message}`);
        }
      }
      
      return collectionId;
    } else {
      console.log('❌ Ошибка создания коллекции:', collectionResponse.status, collectionResponse.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка при создании коллекции:', error.message);
    return null;
  }
}

function getArticlesForSection(sectionName, sectionId) {
  const articles = {
    'Buying Canton Coin': [
      {
        title: 'How to Buy Canton Coin',
        body: 'Complete guide on buying Canton Coin (CC) through 1OTC exchange.',
        section_id: sectionId,
        state: 'published',
        translated_content: {
          en: {
            title: 'How to Buy Canton Coin',
            body: 'Complete guide on buying Canton Coin (CC) through 1OTC exchange.'
          },
          ru: {
            title: 'Как купить Canton Coin',
            body: 'Полное руководство по покупке Canton Coin (CC) через биржу 1OTC.'
          }
        }
      },
      {
        title: 'Supported Networks',
        body: 'List of all supported networks for USDT deposits.',
        section_id: sectionId,
        state: 'published',
        translated_content: {
          en: {
            title: 'Supported Networks',
            body: 'List of all supported networks for USDT deposits.'
          },
          ru: {
            title: 'Поддерживаемые сети',
            body: 'Список всех поддерживаемых сетей для депозитов USDT.'
          }
        }
      }
    ],
    'Pricing and Networks': [
      {
        title: 'Current Canton Coin Price',
        body: 'Real-time Canton Coin (CC) pricing information.',
        section_id: sectionId,
        state: 'published',
        translated_content: {
          en: {
            title: 'Current Canton Coin Price',
            body: 'Real-time Canton Coin (CC) pricing information.'
          },
          ru: {
            title: 'Текущая цена Canton Coin',
            body: 'Информация о цене Canton Coin (CC) в реальном времени.'
          }
        }
      }
    ],
    'Order Management': [
      {
        title: 'Check Order Status',
        body: 'How to check the status of your Canton Coin order.',
        section_id: sectionId,
        state: 'published',
        translated_content: {
          en: {
            title: 'Check Order Status',
            body: 'How to check the status of your Canton Coin order.'
          },
          ru: {
            title: 'Проверить статус заказа',
            body: 'Как проверить статус вашего заказа Canton Coin.'
          }
        }
      }
    ]
  };

  return articles[sectionName] || [];
}

async function createDataAttributes() {
  console.log('\n📊 Создаем кастомные атрибуты для Fin...\n');

  const attributes = [
    {
      name: 'order_id',
      model: 'contact',
      data_type: 'string',
      description: 'Canton OTC order ID',
      options: []
    },
    {
      name: 'order_type',
      model: 'contact',
      data_type: 'string',
      description: 'Type of order (buy/sell)',
      options: ['buy', 'sell']
    },
    {
      name: 'order_status',
      model: 'contact',
      data_type: 'string',
      description: 'Current order status',
      options: ['pending', 'processing', 'completed', 'cancelled']
    },
    {
      name: 'order_amount',
      model: 'contact',
      data_type: 'number',
      description: 'Order amount in USDT',
      options: []
    },
    {
      name: 'canton_address',
      model: 'contact',
      data_type: 'string',
      description: 'Customer Canton address',
      options: []
    },
    {
      name: 'preferred_network',
      model: 'contact',
      data_type: 'string',
      description: 'Preferred USDT network',
      options: ['TRON', 'ETHEREUM', 'BSC', 'SOLANA', 'OPTIMISM']
    }
  ];

  for (const attribute of attributes) {
    try {
      console.log(`🚀 Создаем атрибут: ${attribute.name}...`);
      const response = await makeIntercomRequest('/data_attributes', 'POST', attribute);
      
      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Атрибут создан: ${attribute.name}`);
      } else {
        console.log(`❌ Ошибка создания атрибута: ${response.status}`, response.data);
      }
    } catch (error) {
      console.log(`❌ Ошибка при создании атрибута: ${error.message}`);
    }
  }
}

async function createTags() {
  console.log('\n🏷️ Создаем теги для Fin...\n');

  const tags = [
    { name: 'canton-coin' },
    { name: 'new-customer' },
    { name: 'returning-customer' },
    { name: 'high-value' },
    { name: 'technical-issue' },
    { name: 'payment-issue' },
    { name: 'order-created' },
    { name: 'order-completed' },
    { name: 'needs-human' },
    { name: 'ai-handled' }
  ];

  for (const tag of tags) {
    try {
      console.log(`🚀 Создаем тег: ${tag.name}...`);
      const response = await makeIntercomRequest('/tags', 'POST', tag);
      
      if (response.status === 200 || response.status === 201) {
        console.log(`✅ Тег создан: ${tag.name}`);
      } else {
        console.log(`❌ Ошибка создания тега: ${response.status}`, response.data);
      }
    } catch (error) {
      console.log(`❌ Ошибка при создании тега: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Запуск настройки Fin через стандартные API...\n');
  
  try {
    // 1. Проверяем доступные endpoints
    const apiResults = await checkFinStandardAPI();
    
    // 2. Создаем контент для Help Center (база знаний Fin)
    const collectionId = await createHelpCenterContent();
    
    // 3. Создаем кастомные атрибуты
    await createDataAttributes();
    
    // 4. Создаем теги
    await createTags();
    
    console.log('\n🎉 Настройка Fin через стандартные API завершена!');
    console.log('\n📋 СЛЕДУЮЩИЕ ШАГИ:');
    console.log('1. Перейдите в Intercom Admin Panel');
    console.log('2. Активируйте Fin ассистента');
    console.log('3. Настройте Fin для использования созданной базы знаний');
    console.log('4. Настройте webhook интеграцию с нашим AI агентом');
    console.log('5. Протестируйте интеграцию');
    
    if (collectionId) {
      console.log(`\n📚 Help Center Collection ID: ${collectionId}`);
      console.log('Используйте этот ID для настройки Fin в Admin Panel');
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
  checkFinStandardAPI,
  createHelpCenterContent,
  createDataAttributes,
  createTags
};
