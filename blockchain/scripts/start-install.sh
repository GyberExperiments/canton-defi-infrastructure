#!/usr/bin/expect -f
set timeout 60
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@65.108.15.30
expect "password:"
send "257p5tu_tjJS8g\r"
expect "# "
send "pkill -f mcedit 2>/dev/null || true\r"
expect "# "
send "ps aux | grep installimage | grep -v grep || echo 'no installimage process'\r"
expect "# "
send "installimage -a -c /installimage.bBeEq/install.conf\r"
expect {
    "Starting installation" {
        puts "\n✅ Установка началась!"
    }
    "# " {
        send "tail -5 /var/log/installimage.log 2>/dev/null || echo 'checking status'\r"
        expect "# "
    }
    timeout {
        puts "\n⚠️ Таймаут, но команда отправлена"
    }
}
send "exit\r"
expect eof

