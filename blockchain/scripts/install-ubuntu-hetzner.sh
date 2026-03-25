#!/bin/bash

# 🚀 Установка Ubuntu на Hetzner сервер через Rescue System
# Выполните НА СЕРВЕРЕ 65.108.15.30 в Rescue System

set -e

NODE_IP="65.108.15.30"
HOSTNAME="canton-node-65-108-15-30"

echo "🚀 Установка Ubuntu 24.04 на сервер $NODE_IP"
echo "=========================================="
echo ""

# Проверка что мы в Rescue System
if [ ! -d /root/.oldroot/nfs ]; then
    echo "❌ Похоже, что мы не в Rescue System"
    exit 1
fi

# Создание конфигурационного файла для installimage
CONFIG_FILE="/tmp/install.conf"

cat > "$CONFIG_FILE" << EOF
DRIVE1 /dev/nvme0n1
DRIVE2 /dev/nvme1n1
SWRAID 1
SWRAIDLEVEL 1
BOOTLOADER grub
HOSTNAME $HOSTNAME
PART /boot ext4 1G
PART / ext4 all
IMAGE /root/.oldroot/nfs/install/../images/Ubuntu-2404-jammy-amd64-base.tar.gz
EOF

echo "📋 Конфигурация создана:"
cat "$CONFIG_FILE"
echo ""

read -p "Продолжить установку? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено"
    exit 0
fi

echo ""
echo "📦 Установка Ubuntu 24.04..."
echo "⚠️  Это займет несколько минут..."
echo ""

# Установка
installimage -a -c "$CONFIG_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Ubuntu установлен!"
    echo ""
    echo "⚠️  ВАЖНО: Перезагрузите сервер:"
    echo "   reboot"
    echo ""
    echo "После перезагрузки выполните команды для подключения к k3s кластеру"
else
    echo ""
    echo "❌ Ошибка при установке"
    exit 1
fi

















