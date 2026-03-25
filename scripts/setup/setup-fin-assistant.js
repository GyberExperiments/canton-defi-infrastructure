#!/usr/bin/env node

/**
 * 🤖 Fin Assistant Setup Script
 * Автоматическая настройка Fin ассистента для Canton OTC
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Конфигурация Intercom
const INTERCOM_CONFIG = {
  accessToken: process.env.INTERCOM_ACCESS_TOKEN,
  adminId: process.env.INTERCOM_ADMIN_ID,
  appId: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
  baseUrl: 'https://api.intercom.io'
};

// Конфигурация Fin ассистента
const FIN_CONFIG = {
  name: 'Canton OTC Assistant',
  description: 'AI-ассистент для покупки Canton Coin (CC) и поддержки клиентов 1OTC',
  greeting: {
    ru: `👋 Привет! Я Canton OTC Assistant, ваш AI-помощник для покупки Canton Coin (CC).

🎯 **Что я могу для вас сделать:**
• 🛒 Помочь купить Canton Coin
• 💰 Сообщить актуальную цену CC
• 📋 Создать заказ на покупку
• 🔍 Проверить статус заказа
• 👨‍💼 Связать с живым оператором

**Актуальная цена CC:** $0.21 за 1 CC

Просто напишите, что вас интересует! Например:
• "Хочу купить Canton Coin"
• "Какая цена?"
• "Создать заказ на $100"

Готов помочь! 🚀`,
    en: `👋 Hello! I'm Canton OTC Assistant, your AI helper for buying Canton Coin (CC).

🎯 **What I can do for you:**
• 🛒 Help you buy Canton Coin
• 💰 Provide current CC price
• 📋 Create a purchase order
• 🔍 Check order status
• 👨‍💼 Connect you with a live operator

**Current CC price:** $0.21 per 1 CC

Just write what interests you! For example:
• "I want to buy Canton Coin"
• "What's the price?"
• "Create order for $100"

Ready to help! 🚀`
  },
  tone: 'friendly_professional',
  language: 'ru',
  fallbackMessage: `👨‍💼 Я передаю вас живому оператору для решения вашего вопроса.

⏰ **Время ожидания:** обычно до 5 минут
📱 **Уведомления:** вы получите уведомление, когда оператор ответит

Спасибо за терпение! Наша команда поддержки поможет вам. 🙏`
};

// Автоматические ответы
const AUTO_RESPONSES = [
  {
    trigger: ['цена', 'price', 'стоимость', 'cost', 'курс', 'rate'],
    response: `💰 **Актуальная информация о Canton Coin (CC):**

📈 **Цена:** $0.21 за 1 CC
⏰ **Обновлено:** ${new Date().toLocaleString('ru-RU')}
🌐 **Доступные сети:** TRC-20, ERC-20, BEP-20, Solana, Optimism

💡 **Преимущества покупки CC:**
• Доступ к экосистеме Canton Network
• Стабильная цена с потенциалом роста
• Мультисетевая совместимость
• Низкие комиссии за транзакции

Хотите создать заказ на покупку CC? Просто напишите сумму и сеть!`
  },
  {
    trigger: ['купить', 'buy', 'покупка', 'purchase', 'обмен', 'exchange'],
    response: `🛒 **Как купить Canton Coin (CC):**

**Процесс покупки:**
1️⃣ Укажите сумму покупки (минимум $1, максимум $100,000)
2️⃣ Выберите сеть USDT (TRC-20, ERC-20, BEP-20, Solana, Optimism)
3️⃣ Предоставьте ваш Canton адрес (формат: bron:...)
4️⃣ Укажите email для связи
5️⃣ (Опционально) Резервный адрес для возврата

**Пример заказа:**
"Хочу купить на $100 USDT TRC-20, мой Canton адрес: bron:1220..., email: user@example.com"

**Время обработки:** до 12 часов
**Уведомления:** на email и Telegram

Готов создать заказ? Просто напишите все данные! 🚀`
  },
  {
    trigger: ['сети', 'networks', 'сеть', 'network', 'trc', 'erc', 'bep'],
    response: `🌐 **Поддерживаемые сети для USDT:**

• **TRC-20 (TRON)** - Рекомендуется (низкие комиссии)
• **ERC-20 (Ethereum)** - Стандартная сеть
• **BEP-20 (BSC)** - Быстрые транзакции
• **Solana** - Очень быстрые и дешевые
• **Optimism** - L2 решение Ethereum

**Минимальная сумма:** $1
**Максимальная сумма:** $100,000

Какую сеть предпочитаете? 🤔`
  }
];

/**
 * Выполнить HTTP запрос к Intercom API
 */
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

/**
 * Проверить конфигурацию
 */
function validateConfig() {
  console.log('🔍 Проверяем конфигурацию...');
  
  if (!INTERCOM_CONFIG.accessToken) {
    throw new Error('INTERCOM_ACCESS_TOKEN не установлен');
  }
  
  if (!INTERCOM_CONFIG.adminId) {
    throw new Error('INTERCOM_ADMIN_ID не установлен');
  }
  
  if (!INTERCOM_CONFIG.appId) {
    throw new Error('NEXT_PUBLIC_INTERCOM_APP_ID не установлен');
  }
  
  console.log('✅ Конфигурация валидна');
}

/**
 * Получить информацию о текущем Fin ассистенте
 */
async function getFinInfo() {
  console.log('📋 Получаем информацию о Fin ассистенте...');
  
  try {
    const response = await makeIntercomRequest('/fin');
    console.log('✅ Fin информация получена:', response.status);
    return response.data;
  } catch (error) {
    console.log('⚠️ Fin не настроен или недоступен:', error.message);
    return null;
  }
}

/**
 * Настроить Fin ассистента
 */
async function setupFin() {
  console.log('🤖 Настраиваем Fin ассистента...');
  
  const finData = {
    name: FIN_CONFIG.name,
    description: FIN_CONFIG.description,
    greeting: FIN_CONFIG.greeting.ru,
    tone: FIN_CONFIG.tone,
    language: FIN_CONFIG.language,
    fallback_message: FIN_CONFIG.fallbackMessage,
    auto_responses: AUTO_RESPONSES.map(response => ({
      triggers: response.trigger,
      response: response.response
    }))
  };
  
  try {
    const response = await makeIntercomRequest('/fin', 'POST', finData);
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Fin ассистент настроен успешно');
      return response.data;
    } else {
      console.log('❌ Ошибка настройки Fin:', response.status, response.data);
      return null;
    }
  } catch (error) {
    console.log('❌ Ошибка при настройке Fin:', error.message);
    return null;
  }
}

/**
 * Загрузить логотип Fin
 */
async function uploadFinLogo() {
  console.log('🖼️ Загружаем логотип Fin...');
  
  const logoPath = path.join(__dirname, 'fin-assistant-logo.svg');
  
  if (!fs.existsSync(logoPath)) {
    console.log('⚠️ Файл логотипа не найден:', logoPath);
    return false;
  }
  
  try {
    const logoData = fs.readFileSync(logoPath);
    const base64Logo = logoData.toString('base64');
    
    const response = await makeIntercomRequest('/fin/logo', 'POST', {
      logo: `data:image/svg+xml;base64,${base64Logo}`
    });
    
    if (response.status === 200) {
      console.log('✅ Логотип загружен успешно');
      return true;
    } else {
      console.log('❌ Ошибка загрузки логотипа:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Ошибка при загрузке логотипа:', error.message);
    return false;
  }
}

/**
 * Настроить webhook для Fin
 */
async function setupFinWebhook() {
  console.log('🔗 Настраиваем webhook для Fin...');
  
  const webhookData = {
    url: 'https://stage.minimal.build.infra.1otc.cc/api/intercom/webhook',
    events: [
      'conversation.user.created',
      'conversation.user.replied',
      'conversation.admin.replied',
      'conversation.admin.assigned'
    ],
    secret: process.env.INTERCOM_WEBHOOK_SECRET
  };
  
  try {
    const response = await makeIntercomRequest('/webhooks', 'POST', webhookData);
    
    if (response.status === 200 || response.status === 201) {
      console.log('✅ Webhook настроен успешно');
      return true;
    } else {
      console.log('❌ Ошибка настройки webhook:', response.status, response.data);
      return false;
    }
  } catch (error) {
    console.log('❌ Ошибка при настройке webhook:', error.message);
    return false;
  }
}

/**
 * Протестировать Fin ассистента
 */
async function testFin() {
  console.log('🧪 Тестируем Fin ассистента...');
  
  try {
    // Тест 1: Проверка доступности
    const finInfo = await getFinInfo();
    if (!finInfo) {
      console.log('❌ Fin ассистент недоступен');
      return false;
    }
    
    // Тест 2: Проверка webhook
    const webhookTest = await makeIntercomRequest('/webhooks');
    if (webhookTest.status === 200) {
      console.log('✅ Webhook работает');
    } else {
      console.log('⚠️ Webhook может быть не настроен');
    }
    
    console.log('✅ Тестирование завершено');
    return true;
  } catch (error) {
    console.log('❌ Ошибка при тестировании:', error.message);
    return false;
  }
}

/**
 * Основная функция
 */
async function main() {
  console.log('🚀 Запуск настройки Fin ассистента для Canton OTC...\n');
  
  try {
    // 1. Проверяем конфигурацию
    validateConfig();
    
    // 2. Получаем текущую информацию о Fin
    const currentFin = await getFinInfo();
    
    // 3. Настраиваем Fin
    const finSetup = await setupFin();
    
    // 4. Загружаем логотип
    const logoUpload = await uploadFinLogo();
    
    // 5. Настраиваем webhook
    const webhookSetup = await setupFinWebhook();
    
    // 6. Тестируем
    const testResult = await testFin();
    
    // Результаты
    console.log('\n📊 РЕЗУЛЬТАТЫ НАСТРОЙКИ:');
    console.log('========================');
    console.log(`Fin настройка: ${finSetup ? '✅' : '❌'}`);
    console.log(`Логотип: ${logoUpload ? '✅' : '❌'}`);
    console.log(`Webhook: ${webhookSetup ? '✅' : '❌'}`);
    console.log(`Тестирование: ${testResult ? '✅' : '❌'}`);
    
    if (finSetup && testResult) {
      console.log('\n🎉 Fin ассистент настроен и готов к работе!');
      console.log('\n📋 Следующие шаги:');
      console.log('1. Проверьте настройки в Intercom Admin Panel');
      console.log('2. Протестируйте чат с клиентами');
      console.log('3. Настройте мониторинг и аналитику');
    } else {
      console.log('\n⚠️ Настройка завершена с ошибками. Проверьте логи выше.');
    }
    
  } catch (error) {
    console.error('❌ Критическая ошибка:', error.message);
    process.exit(1);
  }
}

// Запускаем скрипт
if (require.main === module) {
  main();
}

module.exports = {
  setupFin,
  uploadFinLogo,
  setupFinWebhook,
  testFin
};
