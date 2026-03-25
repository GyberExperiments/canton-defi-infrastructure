#!/usr/bin/env node
/**
 * 🔐 Улучшенный скрипт для получения Telegram сессии администратора
 * Используется для настройки Telegram Client API
 * 
 * Улучшения:
 * - Лучшая обработка ошибок
 * - Альтернативный ввод через readline (без пакета input)
 * - Подробное логирование
 * - Проверка подключения
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

// Альтернативный ввод через readline (не требует пакет input)
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

if (!apiId || !apiHash) {
  console.error("❌ TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env.local");
  console.error("");
  console.error("📝 Инструкция:");
  console.error("1. Перейдите на https://my.telegram.org/apps");
  console.error("2. Войдите с номером телефона администратора");
  console.error("3. Создайте новое приложение (Platform: Other)");
  console.error("4. Скопируйте api_id и api_hash");
  console.error("5. Добавьте в .env.local:");
  console.error("   TELEGRAM_API_ID=12345678");
  console.error("   TELEGRAM_API_HASH=abcdef1234567890abcdef1234567890");
  process.exit(1);
}

const stringSession = new StringSession(""); // Используем пустую сессию для первого входа

(async () => {
  console.log("🚀 Запуск Telegram Client для получения сессии...");
  console.log("📱 Используйте номер телефона администратора");
  console.log("");
  console.log("📋 Конфигурация:");
  console.log(`   API ID: ${apiId}`);
  console.log(`   API Hash: ${apiHash.substring(0, 10)}...`);
  console.log("");

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
    retryDelay: 1000,
    timeout: 10000,
  });

  try {
    console.log("🔌 Подключение к Telegram...");
    
    await client.start({
      phoneNumber: async () => {
        const phone = await askQuestion("📱 Введите номер телефона (с кодом страны, например +79991234567): ");
        return phone.trim();
      },
      password: async () => {
        const password = await askQuestion("🔐 Введите пароль 2FA (если установлен, иначе нажмите Enter): ");
        return password.trim() || undefined;
      },
      phoneCode: async () => {
        const code = await askQuestion("📲 Введите код из Telegram: ");
        return code.trim();
      },
      onError: (err) => {
        console.error("❌ Ошибка авторизации:", err);
        if (err.message) {
          console.error("   Сообщение:", err.message);
        }
      },
    });

    console.log("✅ Клиент успешно подключен!");
    
    // Проверяем подключение
    try {
      const me = await client.getMe();
      console.log("👤 Авторизован как:", me.firstName || "", me.lastName || "", `(@${me.username || "без username"})`);
      console.log(`   ID: ${me.id}`);
    } catch (error) {
      console.warn("⚠️ Не удалось получить информацию о пользователе:", error);
    }
    
    // Сохраняем сессию
    console.log("💾 Сохранение сессии...");
    const sessionString = client.session.save();
    
    if (!sessionString || sessionString.length < 10) {
      throw new Error("Сессия слишком короткая или пустая");
    }
    
    // Сохраняем в файл
    const sessionPath = path.join(__dirname, "../.telegram-session");
    fs.writeFileSync(sessionPath, sessionString, "utf8");
    console.log("✅ Файл сессии сохранен:", sessionPath);
    
    // Также сохраняем в .env.local для удобства
    const envPath = path.join(__dirname, "../.env.local");
    let envContent = "";
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, "utf8");
      // Удаляем старую сессию если есть
      envContent = envContent.replace(/TELEGRAM_SESSION_STRING=.*\n/g, "");
    }
    envContent += `\nTELEGRAM_SESSION_STRING=${sessionString}\n`;
    fs.writeFileSync(envPath, envContent, "utf8");
    console.log("✅ Сессия добавлена в .env.local");
    
    console.log("");
    console.log("✅ Сессия успешно получена и сохранена!");
    console.log("");
    console.log("📊 Информация о сессии:");
    console.log(`   Длина: ${sessionString.length} символов`);
    console.log(`   Начинается с: ${sessionString.substring(0, 20)}...`);
    console.log("");
    console.log("⚠️ ВАЖНО: Храните сессию в секрете! Не коммитьте .telegram-session и .env.local в git!");
    console.log("");
    console.log("✅ Готово! Теперь можно использовать Telegram Client API.");
    
    await client.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("");
    console.error("❌ Ошибка при получении сессии:");
    console.error("   Тип:", error.constructor.name);
    console.error("   Сообщение:", error.message);
    if (error.stack) {
      console.error("   Stack:", error.stack.split('\n').slice(0, 5).join('\n'));
    }
    console.error("");
    console.error("💡 Возможные решения:");
    console.error("   1. Проверьте правильность API_ID и API_HASH");
    console.error("   2. Убедитесь, что номер телефона введен с кодом страны (+7...)");
    console.error("   3. Проверьте код из Telegram (он приходит в приложение)");
    console.error("   4. Если включен 2FA, введите правильный пароль");
    console.error("   5. Попробуйте использовать Python скрипт (scripts/setup-telegram-session-telethon.py)");
    
    try {
      await client.disconnect();
    } catch (disconnectError) {
      // Игнорируем ошибки отключения
    }
    process.exit(1);
  }
})();

