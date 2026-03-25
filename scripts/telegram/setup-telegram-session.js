#!/usr/bin/env node
/**
 * 🔐 Скрипт для получения Telegram сессии администратора
 * Используется для настройки Telegram Client API
 */

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const input = require("input");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env.local") });

const apiId = parseInt(process.env.TELEGRAM_API_ID || "0");
const apiHash = process.env.TELEGRAM_API_HASH || "";

if (!apiId || !apiHash) {
  console.error("❌ TELEGRAM_API_ID и TELEGRAM_API_HASH должны быть установлены в .env.local");
  console.error("");
  console.error("📝 Инструкция:");
  console.error("1. Перейдите на https://my.telegram.org/apps");
  console.error("2. Войдите с номером телефона администратора");
  console.error("3. Создайте новое приложение");
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

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  try {
    await client.start({
      phoneNumber: async () => await input.text("Введите номер телефона (с кодом страны, например +79991234567): "),
      password: async () => await input.text("Введите пароль (если установлен 2FA): "),
      phoneCode: async () => await input.text("Введите код из Telegram: "),
      onError: (err) => console.error("❌ Ошибка:", err),
    });

    console.log("✅ Клиент успешно подключен!");
    
    // Получаем информацию о пользователе
    const me = await client.getMe();
    console.log("👤 Авторизован как:", me.firstName, me.lastName || "", `(@${me.username || "без username"})`);
    
    // Сохраняем сессию
    const sessionString = client.session.save();
    
    // Сохраняем в файл
    const sessionPath = path.join(__dirname, "../.telegram-session");
    fs.writeFileSync(sessionPath, sessionString, "utf8");
    
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
    
    console.log("");
    console.log("✅ Сессия сохранена!");
    console.log("📁 Файл сессии:", sessionPath);
    console.log("🔐 Сессия также добавлена в .env.local как TELEGRAM_SESSION_STRING");
    console.log("");
    console.log("⚠️ ВАЖНО: Храните сессию в секрете! Не коммитьте .telegram-session и .env.local в git!");
    
    await client.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Ошибка при получении сессии:", error);
    await client.disconnect();
    process.exit(1);
  }
})();
