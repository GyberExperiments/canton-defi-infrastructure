#!/bin/bash
# Настройка egress к DevNet с source IP 65.108.15.30 на ноде canton-node-65-108-15-30.
# Запускать на ноде от root (или по SSH: ssh -i ~/.ssh/id_rsa_canton root@65.108.15.30 'bash -s' < scripts/setup-devnet-egress-on-node.sh).
# После перезагрузки ноды правила сбрасываются — скрипт нужно запустить снова (или добавить в systemd/rc.local).
set -e

DEVNET_IPS="3.255.2.45 54.154.224.176 52.17.155.209"
SOURCE_IP="65.108.15.30"
GATEWAY="65.108.15.1"
IFACE="enp8s0"
TABLE=100

echo "=== DevNet egress: source $SOURCE_IP для $DEVNET_IPS ==="

# Policy routing: таблица 100
ip route add default via "$GATEWAY" dev "$IFACE" src "$SOURCE_IP" table $TABLE 2>/dev/null || true
for ip in $DEVNET_IPS; do
  ip rule add to "$ip" lookup $TABLE 2>/dev/null || true
done
echo "Policy routing: table $TABLE, rules to $DEVNET_IPS"

# SNAT для подов K8s к DevNet (в начало POSTROUTING)
for ip in $DEVNET_IPS; do
  if ! iptables -t nat -C POSTROUTING -d "$ip" -j SNAT --to-source "$SOURCE_IP" 2>/dev/null; then
    iptables -t nat -I POSTROUTING 1 -d "$ip" -j SNAT --to-source "$SOURCE_IP"
    echo "SNAT: -d $ip -> $SOURCE_IP"
  fi
done
echo "SNAT rules added"

# Проверка
echo ""
echo "--- Проверка ---"
echo "ip route show table $TABLE:"
ip route show table $TABLE
echo ""
echo "ip rule list (to DevNet):"
ip rule list | grep -E "lookup $TABLE|to (3\.255|52\.17|54\.154)" || true
echo ""
echo "iptables POSTROUTING (первые 6):"
iptables -t nat -L POSTROUTING -n -v --line-numbers | head -6
echo ""
echo "Проверка Scan (ожидаем 200):"
curl -s -o /dev/null -w "%{http_code}" -m 10 "https://scan.sv-1.dev.global.canton.network.sync.global/api/scan/version" && echo " OK" || echo " FAIL"
echo "=== Готово ==="
