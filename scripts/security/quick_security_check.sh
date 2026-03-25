#!/bin/bash

# ============================================
# Быстрая проверка безопасности macOS
# Запуск: sudo ./scripts/quick_security_check.sh
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}ОШИБКА: Требуются права root (sudo)${NC}"
    exit 1
fi

echo -e "${BLUE}=== БЫСТРАЯ ПРОВЕРКА БЕЗОПАСНОСТИ ===${NC}"
echo ""

# 1. Проверка процессов
echo -e "${YELLOW}[1] Проверка процессов на майнеры...${NC}"
MINER_PROCS=$(ps aux | grep -iE "(miner|bitcoin|monero|xmrig|cryptonight)" | grep -v grep || true)
if [ -z "$MINER_PROCS" ]; then
    echo -e "${GREEN}✓ Майнеры не обнаружены${NC}"
else
    echo -e "${RED}⚠ Обнаружены подозрительные процессы:${NC}"
    echo "$MINER_PROCS"
fi
echo ""

# 2. Проверка автозагрузки
echo -e "${YELLOW}[2] Проверка автозагрузки...${NC}"
SUSPICIOUS_LAUNCH=$(launchctl list | grep -v "com.apple" | grep -v "PID" || true)
if [ -z "$SUSPICIOUS_LAUNCH" ]; then
    echo -e "${GREEN}✓ Подозрительных сервисов автозагрузки не найдено${NC}"
else
    echo -e "${YELLOW}⚠ Найдены несистемные сервисы:${NC}"
    echo "$SUSPICIOUS_LAUNCH"
fi
echo ""

# 3. Проверка сетевых соединений
echo -e "${YELLOW}[3] Проверка подозрительных сетевых соединений...${NC}"
SUSPICIOUS_NET=$(lsof -i -P | grep ESTABLISHED | grep -vE "(google|apple|microsoft|amazon|github)" | head -10 || true)
if [ -z "$SUSPICIOUS_NET" ]; then
    echo -e "${GREEN}✓ Подозрительных соединений не обнаружено${NC}"
else
    echo -e "${YELLOW}⚠ Найдены необычные соединения:${NC}"
    echo "$SUSPICIOUS_NET"
fi
echo ""

# 4. Быстрая проверка rkhunter
echo -e "${YELLOW}[4] Быстрая проверка руткитов (rkhunter)...${NC}"
if command -v rkhunter &> /dev/null; then
    rkhunter --check --skip-keypress --report-warnings-only --nocolors 2>&1 | tail -20
    echo -e "${GREEN}✓ Проверка завершена${NC}"
else
    echo -e "${RED}✗ rkhunter не установлен${NC}"
fi
echo ""

# 5. Проверка CPU нагрузки
echo -e "${YELLOW}[5] Проверка загрузки CPU...${NC}"
CPU_LOAD=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
if (( $(echo "$CPU_LOAD > 80" | bc -l) )); then
    echo -e "${RED}⚠ Высокая загрузка CPU: ${CPU_LOAD}%${NC}"
    echo "Топ процессов по CPU:"
    ps aux | sort -rk 3,3 | head -5
else
    echo -e "${GREEN}✓ Загрузка CPU нормальная: ${CPU_LOAD}%${NC}"
fi
echo ""

echo -e "${GREEN}=== БЫСТРАЯ ПРОВЕРКА ЗАВЕРШЕНА ===${NC}"
echo -e "${YELLOW}Для полной проверки запустите: sudo ./scripts/security_scan.sh${NC}"

