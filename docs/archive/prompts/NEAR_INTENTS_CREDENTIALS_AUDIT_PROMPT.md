# Промпт для аудита кредов NEAR Intents

## 🔍 Промпт для проверки реализации и определения необходимых кредов

```
Проанализируй интеграцию NEAR Intents DEX в проекте и определи точные креды необходимые для production.

КОНТЕКСТ ПРОЕКТА:
- Next.js 15 приложение с App Router
- Интеграция через @near-js/client для работы с NEAR блокчейном
- Работа напрямую со смарт-контрактами через NEAR RPC
- GitHub Secrets для критичных секретов → синхронизация в Kubernetes через External Secrets Operator
- ConfigMap для некритичных переменных (можно менять из админки)

ФАЙЛЫ ДЛЯ АНАЛИЗА:
1. src/app/api/near-intents/swap/route.ts - API route для создания swap intent
2. src/app/api/near-intents/bridge/route.ts - API route для создания bridge intent  
3. src/app/api/near-intents/status/[intentId]/route.ts - проверка статуса intent
4. src/lib/near-intents.ts - библиотека интеграции
5. src/components/dex/SwapInterface.tsx - UI компонент swap
6. src/components/dex/BridgeInterface.tsx - UI компонент bridge
7. config/kubernetes/k8s/configmap.yaml - ConfigMap с переменными
8. config/kubernetes/k8s/minimal-stage/external-secret.yaml - External Secret для синхронизации
9. config/kubernetes/k8s/deployment.yaml - Deployment с переменными окружения

ЗАДАЧИ:
1. Проанализируй код и определи какие переменные окружения используются
2. Раздели их на категории:
   - Критичные секреты (GitHub Secrets) - API ключи, приватные токены
   - Некритичные переменные (ConfigMap) - публичные URLs, адреса контрактов
3. Проверь документацию NEAR Intents (https://docs.near-intents.org) и определи:
   - Какой адрес смарт-контракта verifier используется
   - Требуется ли REST API ключ для работы
   - Какие методы смарт-контракта нужно вызывать
   - Формат данных для создания swap/bridge intent
4. Сравни требования NEAR Intents с нашей реализацией
5. Определи точный список кредов которые нужно получить от NEAR Intents

ВЫВЕДИ:
1. Список ОБЯЗАТЕЛЬНЫХ кредов от NEAR Intents (что точно нужно получить)
2. Список ОПЦИОНАЛЬНЫХ кредов (что может пригодиться)
3. Что уже настроено и не требует получения кредов
4. Инструкцию как получить каждый кред
5. Где и как хранить каждый кред (GitHub Secrets или ConfigMap)

ВАЖНО:
- Будь точным - не предполагай, только на основе реального кода и документации
- Учитывай что мы работаем напрямую со смарт-контрактами через NEAR RPC
- Различай что является секретом а что публичной информацией
```

---

## 📋 Упрощенный промпт (для быстрого использования):

```
Проанализируй файлы:
- src/app/api/near-intents/*/route.ts
- src/lib/near-intents.ts  
- config/kubernetes/k8s/configmap.yaml
- config/kubernetes/k8s/minimal-stage/external-secret.yaml

И документацию NEAR Intents: https://docs.near-intents.org

Определи:
1. Какие конкретно креды нужно получить от NEAR Intents для работы swap/bridge
2. Куда их добавить (GitHub Secrets или ConfigMap)
3. Где получить каждый кред

Наша реализация работает через NEAR RPC напрямую со смарт-контрактами (@near-js/client).
```


