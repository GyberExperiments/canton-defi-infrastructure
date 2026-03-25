#!/usr/bin/expect -f
# Автоматическая установка k3s на сервер 65.108.15.30

set timeout 600
set NODE_IP "65.108.15.30"
set NODE_USER "root"
set NODE_PASS "257p5tu_tjJS8g"
set MASTER_IP "31.129.105.180"

puts "\n🚀 Автоматическая установка k3s на сервер ${NODE_IP}"
puts "================================================\n"

# Получаем токен с master ноды
puts "🔐 Шаг 1: Получаю токен k3s с master ноды (${MASTER_IP})..."

spawn ssh -o StrictHostKeyChecking=no root@${MASTER_IP} "sudo cat /var/lib/rancher/k3s/server/node-token"

expect {
    "password:" {
        # Если master требует пароль, пропускаем (возможно есть ключ)
        puts "⚠️  Требуется пароль для master ноды"
        close
        wait
        puts "Попробуйте получить токен вручную:"
        puts "  ssh root@${MASTER_IP} 'sudo cat /var/lib/rancher/k3s/server/node-token'"
        set K3S_TOKEN ""
    }
    -re "(K\[0-9a-zA-Z\]+)" {
        set K3S_TOKEN $expect_out(1,string)
        puts "✅ Токен получен: [string range $K3S_TOKEN 0 15]..."
    }
    eof {
        set K3S_TOKEN ""
        puts "⚠️  Не удалось получить токен автоматически"
    }
}

if {[string length $K3S_TOKEN] == 0} {
    puts "\n❌ Необходимо получить токен вручную:"
    puts "   ssh root@${MASTER_IP} 'sudo cat /var/lib/rancher/k3s/server/node-token'"
    puts "\nЗатем запустите установку вручную на сервере ${NODE_IP}:"
    puts "   curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent \\"
    puts "     --server https://${MASTER_IP}:6443 \\"
    puts "     --token <TOKEN> \\"
    puts "     --node-name \$(hostname) \\"
    puts "     --node-ip ${NODE_IP}"
    exit 1
}

# Подключаемся к новому серверу
puts "\n🔗 Шаг 2: Подключаюсь к серверу ${NODE_IP}..."

spawn ssh -o StrictHostKeyChecking=no ${NODE_USER}@${NODE_IP}

expect {
    "password:" {
        send "${NODE_PASS}\r"
        expect {
            "# " { }
            "$ " { }
            timeout {
                puts "❌ Таймаут при подключении"
                exit 1
            }
        }
    }
    "yes/no" {
        send "yes\r"
        expect "password:"
        send "${NODE_PASS}\r"
        expect {
            "# " { }
            "$ " { }
        }
    }
    "# " { }
    "$ " { }
    timeout {
        puts "❌ Таймаут при подключении"
        exit 1
    }
}

# Получаем hostname
puts "📋 Шаг 3: Определяю hostname ноды..."
send "NODE_NAME=\$(hostname)\r"
expect "# "
send "echo \"Node name: \$NODE_NAME\"\r"
expect "# "
send "NODE_IP='${NODE_IP}'\r"
expect "# "

# Установка k3s
puts "📦 Шаг 4: Устанавливаю k3s agent..."
send "echo 'Начинаю установку k3s...'\r"
expect "# "

send "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=latest sh -s - agent --server https://${MASTER_IP}:6443 --token ${K3S_TOKEN} --node-name \$NODE_NAME --node-ip \${NODE_IP}\r"

expect {
    "# " {
        puts "✅ k3s установлен!"
    }
    timeout {
        puts "⚠️  Таймаут (установка может продолжаться)"
    }
}

# Ждем и проверяем
puts "⏳ Ожидание запуска k3s..."
send "sleep 10\r"
expect "# "

send "sudo systemctl status k3s-agent --no-pager | head -5\r"
expect "# "

send "sudo k3s kubectl get nodes 2>/dev/null | grep \$NODE_NAME || echo 'Нода еще не видна в кластере'\r"
expect "# "

puts "\n✅ Установка завершена!"
puts "📋 Hostname ноды: "
send "echo \$NODE_NAME\r"
expect "# "

puts "\n🎯 Следующий шаг: обновите манифест с hostname:"
puts "   cd blockchain/scripts"
puts "   ./update-node-hostname.sh \$NODE_NAME"
puts "   kubectl apply -f ../../config/kubernetes/k8s/canton-validator-new-node.yaml"

send "exit\r"
expect eof

puts "\n✅ Готово!\n"

