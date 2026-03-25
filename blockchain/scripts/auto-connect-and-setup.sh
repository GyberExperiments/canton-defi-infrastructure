#!/usr/bin/expect -f
# Автоматическое подключение и настройка сервера 65.108.15.30
# Использование: ./auto-connect-and-setup.sh

set timeout 300
set server_ip "65.108.15.30"
set server_user "root"
set server_pass "257p5tu_tjJS8g"
set master_ip "31.129.105.180"
set k3s_token "K1087801d7ba6fbe302c62738be2891ae7c953367e423a3e0c5fa1fa61d1f8f6419::server:a30f8f09d77232f9da92b48b94f27f15"

spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null $server_user@$server_ip

expect {
    "password:" {
        send "$server_pass\r"
    }
    "Permission denied" {
        puts "Ошибка подключения"
        exit 1
    }
    timeout {
        puts "Таймаут подключения"
        exit 1
    }
}

expect "# "

# Проверка конфига
send "cat /installimage.bBeEq/install.conf\r"
expect "# "

# Закрытие зависших процессов
send "pkill -f mcedit 2>/dev/null || true\r"
expect "# "

# Проверка статуса установки
send "ps aux | grep installimage | grep -v grep\r"
expect "# "

# Запуск установки если не запущена
send "if ! ps aux | grep installimage | grep -v grep | grep -q -a; then installimage -a -c /installimage.bBeEq/install.conf; fi\r"
expect "# "

# Мониторинг установки (первые строки лога)
send "sleep 2 && tail -20 /var/log/installimage.log 2>/dev/null || echo 'Лог пока не создан'\r"
expect "# "

send "exit\r"
expect eof

puts "\n✅ Команды выполнены на сервере"
puts "Для мониторинга установки подключитесь к серверу и выполните:"
puts "  tail -f /var/log/installimage.log"

