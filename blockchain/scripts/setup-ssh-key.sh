#!/bin/bash

# Скрипт для добавления SSH ключа на сервер
# Использование: ./setup-ssh-key.sh

set -e

SSH_KEY="$HOME/.ssh/id_rsa_canton.pub"
SERVER="root@65.108.15.30"
PASSWORD="257p5tu_tjJS8g"

if [ ! -f "$SSH_KEY" ]; then
    echo "❌ SSH ключ не найден: $SSH_KEY"
    exit 1
fi

echo "🔑 Добавляю SSH ключ на сервер..."

# Читаем публичный ключ
PUBLIC_KEY=$(cat "$SSH_KEY")

# Используем expect для автоматизации
expect << EOF
set timeout 10
spawn ssh -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o PreferredAuthentications=password $SERVER "mkdir -p ~/.ssh && chmod 700 ~/.ssh && echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo 'SUCCESS'"
expect {
    "password:" {
        send "$PASSWORD\r"
        exp_continue
    }
    "SUCCESS" {
        puts "\n✅ Ключ успешно добавлен!"
        exit 0
    }
    timeout {
        puts "\n❌ Таймаут подключения"
        exit 1
    }
    eof
}
EOF

echo ""
echo "🧪 Проверяю подключение без пароля..."
ssh -i ~/.ssh/id_rsa_canton -o StrictHostKeyChecking=no $SERVER "echo '✅ SSH без пароля работает!'" 2>&1

echo ""
echo "✅ Настройка SSH завершена!"





