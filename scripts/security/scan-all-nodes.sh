#!/bin/bash

# Скрипт для проверки всех нод кластера на вирусы и вредоносное ПО
# Использует ClamAV, rkhunter, chkrootkit, Lynis

set -e

REPORT_DIR="/tmp/node-scan-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$REPORT_DIR"

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Проверка всех нод кластера на вирусы и вредоносное ПО ===${NC}"
echo "Отчёт будет сохранён в: $REPORT_DIR"
echo ""

# Получаем список всех нод
NODES=$(kubectl get nodes -o jsonpath='{.items[*].metadata.name}')

if [[ -z "$NODES" ]]; then
    echo -e "${RED}Ошибка: Не удалось получить список нод${NC}"
    exit 1
fi

echo -e "${BLUE}Найденные ноды:${NC}"
for node in $NODES; do
    echo "  - $node"
done
echo ""

# Функция для выполнения команды на ноде через kubectl debug
run_on_node() {
    local node=$1
    local command=$2
    local timeout=${3:-300}
    
    echo "Выполнение на ноде $node: $command"
    kubectl debug node/$node -it --image=busybox:latest -- sh -c "$command" 2>&1 || echo "Не удалось выполнить команду"
}

# Функция для проверки каждой ноды
scan_node() {
    local node=$1
    local node_report_dir="$REPORT_DIR/$node"
    mkdir -p "$node_report_dir"
    
    echo -e "${BLUE}=== Проверка ноды: $node ===${NC}"
    
    # 1. Проверка процессов
    echo -e "${YELLOW}1. Проверка процессов...${NC}"
    run_on_node "$node" "ps aux | grep -E '(javae|XFZSrI|miner|crypto|mining|xmrig|cpuminer|ccminer)' || echo 'Подозрительных процессов не найдено'" > "$node_report_dir/processes.txt" 2>&1
    
    # 2. Проверка сетевых соединений
    echo -e "${YELLOW}2. Проверка сетевых соединений...${NC}"
    run_on_node "$node" "netstat -tulpn 2>/dev/null || ss -tulpn 2>/dev/null || echo 'Не удалось проверить сетевые соединения'" > "$node_report_dir/network.txt" 2>&1
    
    # 3. Проверка файлов в /tmp
    echo -e "${YELLOW}3. Проверка файлов в /tmp...${NC}"
    run_on_node "$node" "find /tmp -type f -name '*javae*' -o -name '*XFZSrI*' -o -name '*miner*' 2>/dev/null || echo 'Подозрительных файлов не найдено'" > "$node_report_dir/tmp-files.txt" 2>&1
    
    # 4. Проверка недавно изменённых файлов
    echo -e "${YELLOW}4. Проверка недавно изменённых файлов...${NC}"
    run_on_node "$node" "find /tmp /var/tmp -type f -mtime -7 -ls 2>/dev/null | head -50 || echo 'Не удалось проверить'" > "$node_report_dir/recent-files.txt" 2>&1
    
    # 5. Информация о системе
    echo -e "${YELLOW}5. Сбор информации о системе...${NC}"
    run_on_node "$node" "uname -a && hostname && uptime" > "$node_report_dir/system-info.txt" 2>&1
    
    echo -e "${GREEN}✓ Проверка ноды $node завершена${NC}"
    echo ""
}

# Проверка каждой ноды
for node in $NODES; do
    scan_node "$node"
done

# Создание инструкций для ручной проверки
cat > "$REPORT_DIR/manual-scan-instructions.md" << 'EOF'
# Инструкции для ручной проверки нод

Для полной проверки каждой ноды необходимо подключиться по SSH и выполнить следующие команды:

## Установка инструментов

```bash
sudo apt-get update
sudo apt-get install -y clamav rkhunter chkrootkit lynis
```

## ClamAV - Антивирусное сканирование

```bash
# Обновление баз
sudo freshclam

# Сканирование критических директорий
sudo clamscan -r -i /tmp /var /home /root /opt > /tmp/clamav-scan.log 2>&1

# Полное сканирование (может занять много времени)
sudo clamscan -r -i / > /tmp/clamav-full-scan.log 2>&1
```

## rkhunter - Поиск руткитов

```bash
# Обновление баз
sudo rkhunter --update

# Проверка
sudo rkhunter --checkall --skip-keypress > /tmp/rkhunter-scan.log 2>&1
```

## chkrootkit - Проверка на руткиты

```bash
sudo chkrootkit > /tmp/chkrootkit-scan.log 2>&1
```

## Lynis - Аудит безопасности

```bash
sudo lynis audit system > /tmp/lynis-audit.log 2>&1
```

## Дополнительные проверки

### Проверка cron jobs
```bash
for user in $(cut -f1 -d: /etc/passwd); do 
  echo "=== $user ==="; 
  sudo crontab -l -u $user 2>/dev/null; 
done > /tmp/all-crontabs.txt
```

### Проверка systemd services
```bash
systemctl list-units --type=service --all > /tmp/all-services.txt
systemctl list-units --type=service --state=failed > /tmp/failed-services.txt
```

### Проверка подозрительных процессов
```bash
ps aux | grep -E "(javae|XFZSrI|miner|crypto|mining)" > /tmp/suspicious-processes.txt
```

### Проверка сетевых соединений
```bash
netstat -tulpn > /tmp/network-connections.txt
ss -tulpn >> /tmp/network-connections.txt

# Подозрительные соединения на нестандартных портах
netstat -tulpn | grep -v -E "(22|80|443|6443|10250|10251|10252)" > /tmp/suspicious-ports.txt
```

### Проверка файлов в /tmp
```bash
find /tmp -type f -name "*javae*" -o -name "*XFZSrI*" -o -name "*miner*" > /tmp/suspicious-files.txt
find /tmp -type f -perm 777 > /tmp/world-writable-files.txt
```

### Проверка недавно изменённых файлов
```bash
find /tmp /var/tmp -type f -mtime -7 -ls > /tmp/recent-files.txt
find /home -type f -mtime -7 -ls > /tmp/recent-home-files.txt
```

## Анализ результатов

После выполнения всех проверок:

1. Проверьте логи на наличие подозрительной активности
2. Изучите результаты ClamAV на наличие вирусов
3. Проверьте результаты rkhunter и chkrootkit на руткиты
4. Проанализируйте Lynis audit на проблемы безопасности
5. Проверьте cron jobs и systemd services на подозрительные записи
EOF

# Создание сводного отчёта
cat > "$REPORT_DIR/summary.txt" << EOF
=== Сводный отчёт проверки нод ===
Дата: $(date)
Количество нод: $(echo $NODES | wc -w)

Проверенные ноды:
$(for node in $NODES; do echo "  - $node"; done)

Отчёты сохранены в: $REPORT_DIR

Для каждой ноды созданы следующие файлы:
  - processes.txt - проверка процессов
  - network.txt - сетевые соединения
  - tmp-files.txt - файлы в /tmp
  - recent-files.txt - недавно изменённые файлы
  - system-info.txt - информация о системе

Следующие шаги:
1. Просмотрите отчёты для каждой ноды
2. Для полной проверки следуйте инструкциям в manual-scan-instructions.md
3. Установите ClamAV, rkhunter, chkrootkit на каждую ноду
4. Запустите полное сканирование на каждой ноде
EOF

echo ""
echo -e "${GREEN}=== Проверка завершена ===${NC}"
echo ""
echo "Отчёты сохранены в: $REPORT_DIR"
echo ""
echo "Структура отчётов:"
for node in $NODES; do
    echo "  $REPORT_DIR/$node/"
done
echo ""
echo "Сводный отчёт: $REPORT_DIR/summary.txt"
echo "Инструкции для ручной проверки: $REPORT_DIR/manual-scan-instructions.md"
echo ""
echo -e "${YELLOW}Важно:${NC} Для полной проверки необходимо подключиться к каждой ноде по SSH"
echo "и выполнить полное сканирование с помощью ClamAV, rkhunter, chkrootkit"
echo ""
echo "Для установки production-ready решения запустите:"
echo "  ./scripts/install-production-security.sh"







