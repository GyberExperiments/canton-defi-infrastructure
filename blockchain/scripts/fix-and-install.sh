#!/usr/bin/expect -f
set timeout 300
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@65.108.15.30
expect "password:"
send "257p5tu_tjJS8g\r"
expect "# "

# Удаление автозагрузочного файла который конфликтует
send "rm -f /autosetup 2>/dev/null || true\r"
expect "# "

# Создание правильного конфига
send "cat > /installimage.bBeEq/install.conf << 'CONFIGEOF'\r"
expect "> "
send "DRIVE1 /dev/nvme0n1\r"
expect "> "
send "DRIVE2 /dev/nvme1n1\r"
expect "> "
send "SWRAID 1\r"
expect "> "
send "SWRAIDLEVEL 1\r"
expect "> "
send "BOOTLOADER grub\r"
expect "> "
send "HOSTNAME canton-node-65-108-15-30\r"
expect "> "
send "PART /boot ext4 1G\r"
expect "> "
send "PART / ext4 all\r"
expect "> "
send "IMAGE /root/.oldroot/nfs/install/../images/Ubuntu-2404-jammy-amd64-base.tar.gz\r"
expect "> "
send "CONFIGEOF\r"
expect "# "

# Проверка конфига
send "cat /installimage.bBeEq/install.conf\r"
expect "# "

# Запуск установки
send "installimage -a -c /installimage.bBeEq/install.conf\r"
expect {
    "Starting installation" {
        puts "\n✅ Установка началась!"
    }
    "Running unattended" {
        puts "\n✅ Установка началась (unattended mode)!"
    }
    "# " {
        send "sleep 3 && tail -10 /var/log/installimage.log 2>/dev/null || echo 'waiting for log'\r"
        expect "# "
    }
    timeout {
        puts "\n⚠️ Команда отправлена, проверьте логи"
    }
}
send "exit\r"
expect eof

















