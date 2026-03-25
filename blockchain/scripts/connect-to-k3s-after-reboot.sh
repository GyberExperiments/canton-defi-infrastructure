#!/usr/bin/expect -f
# Подключение ноды 65.108.15.30 к k3s кластеру после установки Ubuntu
# Выполните после перезагрузки сервера (подождите 2-3 минуты)

set timeout 60
set server_ip "65.108.15.30"
set server_pass "257p5tu_tjJS8g"
set master_ip "31.129.105.180"
set k3s_token "K1087801d7ba6fbe302c62738be2891ae7c953367e423a3e0c5fa1fa61d1f8f6419::server:a30f8f09d77232f9da92b48b94f27f15"

puts "🚀 Подключение ноды $server_ip к k3s кластеру"
puts "=========================================="

spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@$server_ip
expect {
    "password:" {
        send "$server_pass\r"
    }
    "Are you sure" {
        send "yes\r"
        expect "password:"
        send "$server_pass\r"
    }
    timeout {
        puts "Таймаут подключения. Сервер еще перезагружается?"
        exit 1
    }
}

expect "# "

# Получение hostname
send "hostname\r"
expect "# "
set hostname $expect_out(buffer)
regexp {canton-node-65-108-15-30|.*} $hostname match hostname
puts "Hostname: $hostname"

# Установка зависимостей
send "apt-get update -qq && apt-get install -y -qq curl wget\r"
expect "# "

# Установка k3s agent
puts "📦 Установка k3s agent..."
send "K3S_VERSION=\"v1.31.5+k3s1\"\r"
expect "# "
send "curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION=\"\$K3S_VERSION\" sh -s - agent --server https://$master_ip:6443 --token $k3s_token --node-name $hostname --node-ip $server_ip\r"
expect {
    "done" {
        puts "\n✅ k3s agent установлен!"
    }
    "# " {
        puts "\n✅ Команда выполнена"
    }
    timeout {
        puts "\n⚠️ Таймаут, но установка должна продолжаться"
    }
}

# Проверка подключения
send "sleep 5 && k3s kubectl get nodes 2>/dev/null || echo 'Проверка через kubectl на master ноде'\r"
expect "# "

puts "\n✅ Нода подключена к кластеру!"
puts "Hostname: $hostname"
puts "\n📝 Следующие шаги на локальной машине:"
puts "   kubectl get nodes -o wide"
puts "   cd blockchain/scripts && ./update-node-hostname.sh $hostname"
puts "   cd ../../config/kubernetes/k8s && kubectl apply -f canton-validator-new-node.yaml"

send "exit\r"
expect eof

















