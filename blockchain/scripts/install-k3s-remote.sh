#!/usr/bin/expect -f
# Автоматическая установка k3s на удаленный сервер
# Использование: ./install-k3s-remote.sh

set timeout 300
set NODE_IP "65.108.15.30"
set NODE_USER "root"
set NODE_PASS "257p5tu_tjJS8g"
set MASTER_IP "31.129.105.180"

# Получаем токен с master ноды
puts "🔐 Получаю токен k3s с master ноды..."
spawn ssh -o StrictHostKeyChecking=no root@${MASTER_IP} "sudo cat /var/lib/rancher/k3s/server/node-token"
expect {
    "password:" {
        send "пароль_для_master\r"
        expect {
            -re "K[0-9]+.*" {
                set K3S_TOKEN $expect_out(0,string)
            }
            timeout {
                puts "❌ Не удалось получить токен"
                exit 1
            }
        }
    }
    -re "K[0-9]+.*" {
        set K3S_TOKEN $expect_out(0,string)
    }
    timeout {
        puts "❌ Таймаут при получении токена"
        exit 1
    }
}
close
wait

puts "✅ Токен получен: [string range $K3S_TOKEN 0 10]..."

# Подключаемся к новому серверу и устанавливаем k3s
puts "🚀 Подключаюсь к серверу ${NODE_IP}..."
spawn ssh -o StrictHostKeyChecking=no ${NODE_USER}@${NODE_IP}

expect {
    "password:" {
        send "${NODE_PASS}\r"
    }
    "yes/no" {
        send "yes\r"
        expect "password:"
        send "${NODE_PASS}\r"
    }
}

expect "# "

# Получаем hostname
send "NODE_NAME=\$(hostname)\r"
expect "# "
send "echo \"Node name: \$NODE_NAME\"\r"
expect "# "

# Установка k3s
puts "📦 Устанавливаю k3s agent..."
send "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent --server https://${MASTER_IP}:6443 --token $K3S_TOKEN --node-name \$NODE_NAME --node-ip ${NODE_IP}\r"

expect {
    "# " {
        puts "✅ k3s установлен!"
    }
    timeout {
        puts "⚠️  Таймаут, но установка может продолжаться"
    }
}

# Проверка
send "sleep 5\r"
expect "# "
send "sudo k3s kubectl get nodes 2>/dev/null || echo 'k3s еще запускается'\r"
expect "# "
send "echo \"Hostname: \$NODE_NAME\"\r"
expect "# "

puts "✅ Установка завершена!"
puts "📋 Сообщите hostname для обновления манифеста"

send "exit\r"
expect eof

