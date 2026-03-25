#!/bin/bash

# ============================================
# Комплексная проверка безопасности macOS
# Запуск: sudo ./scripts/security_scan.sh
# ============================================

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Unicode символы
CHECKMARK="✓"
CROSS="✗"
ARROW="▶"
SPINNER_CHARS="⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"
PROGRESS_FILL="█"
PROGRESS_EMPTY="░"

# Глобальные переменные
TOTAL_STEPS=15
CURRENT_STEP=0
START_TIME=$(date +%s)

# ============================================
# ФУНКЦИИ ДЛЯ ИНДИКАТОРОВ
# ============================================

# Функция спиннера (для длительных операций)
spinner() {
    local pid=$1
    local message=$2
    local spin_index=0
    
    while kill -0 $pid 2>/dev/null; do
        spin_index=$(( (spin_index + 1) % 10 ))
        printf "\r${CYAN}${SPINNER_CHARS:$spin_index:1}${NC} ${message}... "
        sleep 0.1
    done
    wait $pid
    local exit_code=$?
    printf "\r${GREEN}${CHECKMARK}${NC} ${message} - завершено\n"
    return $exit_code
}

# Функция прогресс-бара
show_progress() {
    local current=$1
    local total=$2
    local message=$3
    local width=50
    
    # Более точный расчет процента (с округлением)
    local percent=$(( (current * 1000 / total + 5) / 10 ))
    local filled=$((current * width / total))
    local empty=$((width - filled))
    
    # Создаем строку прогресса
    local progress_bar=""
    for ((i=0; i<filled; i++)); do
        progress_bar+="${PROGRESS_FILL}"
    done
    for ((i=0; i<empty; i++)); do
        progress_bar+="${PROGRESS_EMPTY}"
    done
    
    # Вычисляем время
    local elapsed=$(($(date +%s) - START_TIME))
    local mins=$((elapsed / 60))
    local secs=$((elapsed % 60))
    
    # Очищаем предыдущую строку и выводим новую
    printf "\033[2K\r"  # Очистка строки
    printf "${BLUE}[${current}/${total}]${NC} ${BOLD}${message}${NC}  ${CYAN}[${progress_bar}]${NC} ${BOLD}${percent}%%${NC}  ${YELLOW}⏱ ${mins}m ${secs}s${NC}"
    printf "\n"  # Переход на новую строку
}

# Функция для выполнения команды с индикацией
run_with_progress() {
    local step_num=$1
    local step_name=$2
    local command=$3
    local log_file=$4
    
    CURRENT_STEP=$step_num
    show_progress $step_num $TOTAL_STEPS "$step_name"
    
    # Запускаем команду в фоне и показываем спиннер
    eval "$command" > "$log_file.tmp" 2>&1 &
    local cmd_pid=$!
    
    # Показываем спиннер пока команда выполняется
    spinner $cmd_pid "Выполнение проверки" || true
    
    # Копируем вывод в основной лог
    cat "$log_file.tmp" >> "$log_file"
    rm -f "$log_file.tmp"
    
    echo ""
}

# Функция таймера для этапа
start_timer() {
    echo -n "$(date +%s)"
}

get_elapsed_time() {
    local start_time=$1
    local end_time=$(date +%s)
    local elapsed=$((end_time - start_time))
    local mins=$((elapsed / 60))
    local secs=$((elapsed % 60))
    printf "%dm %ds" $mins $secs
}

# ============================================
# ПРОВЕРКА ПРАВ ROOT
# ============================================
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}${CROSS} ОШИБКА: Этот скрипт требует прав root (sudo)${NC}"
    echo "Запустите: sudo $0"
    exit 1
fi

# ============================================
# ЗАГОЛОВОК
# ============================================
clear
echo -e "${BLUE}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}${BOLD}║   ПРОВЕРКА БЕЗОПАСНОСТИ macOS          ║${NC}"
echo -e "${BLUE}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""

# Создаем директорию для отчетов
REPORT_DIR="$HOME/security_scan_reports"
mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$REPORT_DIR/security_scan_${TIMESTAMP}.txt"
TEMP_LOG="/tmp/security_scan_${TIMESTAMP}.log"

{
    echo "=========================================="
    echo "ОТЧЕТ О ПРОВЕРКЕ БЕЗОПАСНОСТИ"
    echo "Дата: $(date)"
    echo "Пользователь: $(whoami)"
    echo "Система: $(sw_vers -productName) $(sw_vers -productVersion)"
    echo "=========================================="
    echo ""
} | tee "$REPORT_FILE"

echo -e "${CYAN}${BOLD}Отчет будет сохранен в: ${YELLOW}$REPORT_FILE${NC}"
echo -e "${CYAN}Начало проверки: ${YELLOW}$(date '+%H:%M:%S')${NC}\n"

# ============================================
# 1. ОБНОВЛЕНИЕ БАЗ rkhunter
# ============================================
STEP_START=$(start_timer)
show_progress 1 $TOTAL_STEPS "Обновление баз данных rkhunter"

if command -v rkhunter &> /dev/null; then
    # Обновляем базы с выводом на экран и в файл
    rkhunter --update --nocolors 2>&1 | tee -a "$REPORT_FILE"
    
    # Создаем базу свойств файлов, если её нет
    if [ ! -f /var/lib/rkhunter/db/rkhunter.dat ]; then
        echo -e "${YELLOW}Создание базы свойств файлов (первый запуск)...${NC}"
        rkhunter --propupd --nocolors 2>&1 | tee -a "$REPORT_FILE"
    fi
    
    ELAPSED=$(get_elapsed_time $STEP_START)
    printf "\033[2K\r"  # Очистка строки
    echo -e "${GREEN}${CHECKMARK} Базы обновлены${NC} ${CYAN}(время: $ELAPSED)${NC}"
else
    printf "\033[2K\r"  # Очистка строки
    echo -e "${RED}${CROSS} rkhunter не установлен${NC}"
fi
echo ""

# ============================================
# 2. ПРОВЕРКА РУТКИТОВ (rkhunter)
# ============================================
STEP_START=$(start_timer)
show_progress 2 $TOTAL_STEPS "Проверка руткитов (rkhunter)"

if command -v rkhunter &> /dev/null; then
    printf "\033[2K\r${YELLOW}ⓘ Это может занять 2-5 минут... Предупреждения о скриптах - это нормально для macOS${NC}\n"
    
    # Запускаем проверку в фоне с полным выводом на экран и в файл
    (rkhunter --check --skip-keypress --report-warnings-only --nocolors 2>&1 | \
        tee -a "$REPORT_FILE") &
    
    check_pid=$!
    spinner $check_pid "Сканирование системы на руткиты"
    
    ELAPSED=$(get_elapsed_time $STEP_START)
    printf "\033[2K\r"
    echo -e "${GREEN}${CHECKMARK} Проверка rkhunter завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
else
    printf "\033[2K\r"
    echo -e "${RED}${CROSS} rkhunter не установлен${NC}"
fi
echo ""

# ============================================
# 3. ПРОВЕРКА РУТКИТОВ (chkrootkit)
# ============================================
STEP_START=$(start_timer)
show_progress 3 $TOTAL_STEPS "Проверка руткитов (chkrootkit)"

if command -v chkrootkit &> /dev/null; then
    printf "\033[2K\r${YELLOW}ⓘ Это может занять 3-7 минут...${NC}\n"
    
    # Полный вывод на экран и в файл
    (chkrootkit 2>&1 | tee -a "$REPORT_FILE") &
    
    chk_pid=$!
    spinner $chk_pid "Сканирование системы на руткиты (chkrootkit)"
    
    ELAPSED=$(get_elapsed_time $STEP_START)
    printf "\033[2K\r"
    echo -e "${GREEN}${CHECKMARK} Проверка chkrootkit завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
else
    printf "\033[2K\r"
    echo -e "${RED}${CROSS} chkrootkit не установлен${NC}"
fi
echo ""

# ============================================
# 4. ПРОВЕРКА ПРОЦЕССОВ НА МАЙНЕРЫ
# ============================================
STEP_START=$(start_timer)
show_progress 4 $TOTAL_STEPS "Проверка процессов на майнеры"

{
    echo "--- Подозрительные процессы ---"
    ps aux | grep -iE "(miner|bitcoin|monero|xmrig|cryptonight|nicehash|mining)" | grep -v grep || echo "✓ Подозрительных процессов не найдено"
    echo ""
    echo "--- Процессы с высоким CPU ---"
    ps aux | sort -rk 3,3 | head -15
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка процессов завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 5. ПРОВЕРКА АВТОЗАГРУЗКИ
# ============================================
STEP_START=$(start_timer)
show_progress 5 $TOTAL_STEPS "Проверка автозагрузки"

{
    echo "--- LaunchAgents пользователя ---"
    ls -la ~/Library/LaunchAgents/ 2>/dev/null || echo "✓ Директория пуста или недоступна"
    echo ""
    echo "--- LaunchDaemons системы ---"
    ls -la /Library/LaunchDaemons/ 2>/dev/null | grep -v "com.apple" || echo "✓ Только системные сервисы Apple"
    echo ""
    echo "--- Запущенные сервисы (не Apple) ---"
    launchctl list | grep -v "com.apple" | grep -v "PID" || echo "✓ Только системные сервисы Apple"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка автозагрузки завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 6. ПРОВЕРКА СЕТЕВЫХ СОЕДИНЕНИЙ
# ============================================
STEP_START=$(start_timer)
show_progress 6 $TOTAL_STEPS "Проверка сетевых соединений"

{
    echo "--- Активные соединения ---"
    lsof -i -P | grep ESTABLISHED | head -30
    echo ""
    echo "--- Слушающие порты ---"
    lsof -i -P | grep LISTEN | head -20
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка сети завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 7. ПОИСК ПОДОЗРИТЕЛЬНЫХ ФАЙЛОВ
# ============================================
STEP_START=$(start_timer)
show_progress 7 $TOTAL_STEPS "Поиск подозрительных файлов"

printf "\033[2K\r${YELLOW}ⓘ Поиск может занять несколько минут...${NC}\n"

{
    echo "--- Поиск файлов майнеров ---"
    find /Users -maxdepth 5 -type f \( -iname "*miner*" -o -iname "*xmrig*" -o -iname "*cryptonight*" \) 2>/dev/null | head -20 || echo "✓ Файлы майнеров не найдены"
    echo ""
    echo "--- Поиск скрытых исполняемых файлов ---"
    find ~ -maxdepth 3 -type f -perm +111 -name ".*" 2>/dev/null | head -20 || echo "✓ Скрытых исполняемых файлов не найдено"
    echo ""
    echo "--- Проверка cron задач ---"
    crontab -l 2>/dev/null || echo "✓ Cron задач нет"
    sudo crontab -l 2>/dev/null || echo "✓ Системных cron задач нет"
} | tee -a "$REPORT_FILE" &
find_pid=$!
spinner $find_pid "Сканирование файловой системы"

ELAPSED=$(get_elapsed_time $STEP_START)
printf "\033[2K\r"
echo -e "${GREEN}${CHECKMARK} Поиск файлов завершен${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 8. ПРОВЕРКА ПОДПИСЕЙ ПРИЛОЖЕНИЙ
# ============================================
STEP_START=$(start_timer)
show_progress 8 $TOTAL_STEPS "Проверка подписей приложений"

{
    echo "--- Приложения с невалидными подписями ---"
    find /Applications -maxdepth 1 -name "*.app" -exec sh -c 'codesign --verify --verbose "$1" 2>&1 | grep -q "invalid\|error" && echo "$1"' _ {} \; || echo "✓ Все приложения имеют валидные подписи"
    echo ""
    echo "--- Приложения, отклоненные Gatekeeper ---"
    find /Applications -maxdepth 1 -name "*.app" -exec sh -c 'spctl --assess --verbose "$1" 2>&1 | grep -q "rejected" && echo "$1"' _ {} \; || echo "✓ Все приложения одобрены Gatekeeper"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка подписей завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 9. ПРОВЕРКА СИСТЕМНЫХ ЛОГОВ
# ============================================
STEP_START=$(start_timer)
show_progress 9 $TOTAL_STEPS "Проверка системных логов"

{
    echo "--- Подозрительная активность в системных логах (последний час) ---"
    log show --predicate 'process == "kernel"' --last 1h 2>/dev/null | grep -iE "(error|warning|unauthorized|failed|denied)" | tail -20 || echo "✓ Подозрительной активности не найдено"
    echo ""
    echo "--- Логи установки приложений (последние 7 дней) ---"
    log show --predicate 'eventMessage contains "install"' --last 7d 2>/dev/null | tail -10 || echo "✓ Логов установки не найдено"
    echo ""
    echo "--- Логи сетевой активности ---"
    log show --predicate 'subsystem == "com.apple.network"' --last 1h 2>/dev/null | grep -iE "(connection|failed|denied)" | tail -10 || echo "✓ Подозрительной сетевой активности не найдено"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка логов завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 10. ПРОВЕРКА СИСТЕМНЫХ РАСШИРЕНИЙ
# ============================================
STEP_START=$(start_timer)
show_progress 10 $TOTAL_STEPS "Проверка системных расширений"

{
    echo "--- Установленные системные расширения ---"
    systemextensionsctl list 2>/dev/null || echo "✓ Системных расширений не найдено"
    echo ""
    echo "--- Расширения ядра ---"
    kextstat | grep -v "com.apple" | head -20 || echo "✓ Только системные расширения Apple"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка расширений завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 11. ПРОВЕРКА DNS И СЕТЕВОЙ АКТИВНОСТИ
# ============================================
STEP_START=$(start_timer)
show_progress 11 $TOTAL_STEPS "Проверка DNS и сетевой активности"

{
    echo "--- DNS серверы ---"
    scutil --dns | grep "nameserver\[" | head -10
    echo ""
    echo "--- Подозрительные DNS запросы (если доступен tcpdump) ---"
    if command -v tcpdump &> /dev/null; then
        timeout 5 tcpdump -i any -n port 53 2>/dev/null | head -10 || echo "DNS запросы не обнаружены за 5 секунд"
    else
        echo "tcpdump не установлен (опционально для детальной проверки DNS)"
    fi
    echo ""
    echo "--- Все слушающие порты с процессами ---"
    lsof -i -P | grep LISTEN | awk '{print $1, $2, $9}' | sort -u | head -30
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка DNS завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 12. ПРОВЕРКА ФАЙЛОВЫХ РАЗРЕШЕНИЙ
# ============================================
STEP_START=$(start_timer)
show_progress 12 $TOTAL_STEPS "Проверка файловых разрешений"

{
    echo "--- Файлы с подозрительными разрешениями (SUID/SGID) ---"
    find /usr /bin /sbin /opt /Applications -type f -perm -4000 2>/dev/null | head -20 || echo "✓ SUID файлы не найдены"
    echo ""
    find /usr /bin /sbin /opt /Applications -type f -perm -2000 2>/dev/null | head -20 || echo "✓ SGID файлы не найдены"
    echo ""
    echo "--- Файлы с правами записи для всех ---"
    find /usr /bin /sbin -type f -perm -002 2>/dev/null | head -20 || echo "✓ Файлы с правами записи для всех не найдены"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка разрешений завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 13. ПРОВЕРКА УСТАНОВЛЕННЫХ ПАКЕТОВ
# ============================================
STEP_START=$(start_timer)
show_progress 13 $TOTAL_STEPS "Проверка установленных пакетов"

{
    echo "--- Установленные пакеты Homebrew ---"
    if command -v brew &> /dev/null; then
        brew list --formula | head -30
        echo ""
        echo "--- Устаревшие пакеты ---"
        brew outdated 2>/dev/null | head -20 || echo "✓ Все пакеты обновлены"
    else
        echo "Homebrew не установлен"
    fi
    echo ""
    echo "--- Установленные приложения ---"
    ls -1 /Applications | head -30
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка пакетов завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 14. ПРОВЕРКА ИСПОЛЬЗОВАНИЯ РЕСУРСОВ
# ============================================
STEP_START=$(start_timer)
show_progress 14 $TOTAL_STEPS "Проверка использования ресурсов"

{
    echo "--- Текущая загрузка системы ---"
    echo "CPU:"
    top -l 1 | grep "CPU usage" || iostat -c 2 | tail -1
    echo ""
    echo "Память:"
    vm_stat | head -10
    echo ""
    echo "--- Процессы с высоким использованием CPU ---"
    ps aux | sort -rk 3,3 | head -10
    echo ""
    echo "--- Процессы с высоким использованием памяти ---"
    ps aux | sort -rk 4,4 | head -10
    echo ""
    echo "--- Использование диска ---"
    df -h | head -10
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка ресурсов завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# 15. ПРОВЕРКА ИСТОРИИ И СКРЫТЫХ ФАЙЛОВ
# ============================================
STEP_START=$(start_timer)
show_progress 15 $TOTAL_STEPS "Проверка истории и скрытых файлов"

{
    echo "--- История команд (последние 20) ---"
    history | tail -20 2>/dev/null || echo "История недоступна"
    echo ""
    echo "--- Скрытые файлы в домашней директории ---"
    find ~ -maxdepth 2 -name ".*" -type f 2>/dev/null | head -30
    echo ""
    echo "--- Скрытые директории в корне ---"
    ls -la / | grep "^\." | head -20
    echo ""
    echo "--- Файлы в /tmp с подозрительными именами ---"
    find /tmp -type f -name "*miner*" -o -name "*crypto*" -o -name "*.sh" 2>/dev/null | head -20 || echo "✓ Подозрительных файлов в /tmp не найдено"
} | tee -a "$REPORT_FILE"

ELAPSED=$(get_elapsed_time $STEP_START)
echo -e "${GREEN}${CHECKMARK} Проверка истории завершена${NC} ${CYAN}(время: $ELAPSED)${NC}"
echo ""

# ============================================
# ИТОГОВЫЙ ОТЧЕТ
# ============================================
TOTAL_TIME=$(get_elapsed_time $START_TIME)

echo ""
echo -e "${BLUE}${BOLD}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ПРОВЕРКА УСПЕШНО ЗАВЕРШЕНА         ║${NC}"
echo -e "${BLUE}${BOLD}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}${BOLD}Общее время выполнения: ${YELLOW}${TOTAL_TIME}${NC}"
echo -e "${CYAN}${BOLD}Полный отчет сохранен в:${NC}"
echo -e "${YELLOW}${BOLD}  $REPORT_FILE${NC}"
echo ""
echo -e "${MAGENTA}${BOLD}РЕКОМЕНДАЦИИ:${NC}"
echo -e "  ${ARROW} Просмотрите отчет: ${CYAN}cat $REPORT_FILE${NC}"
echo -e "  ${ARROW} Проверьте все предупреждения в отчете"
echo -e "  ${ARROW} Если найдены подозрительные процессы - завершите их"
echo -e "  ${ARROW} Если найдены подозрительные файлы - удалите их"
echo -e "  ${ARROW} Регулярно запускайте этот скрипт для проверки"
echo ""
echo -e "${GREEN}${BOLD}${CHECKMARK} Система проверена!${NC}\n"
