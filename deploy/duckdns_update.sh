#!/bin/bash
# DuckDNS IP updater - run this on the server at 119.196.25.58
# Setup: chmod +x duckdns_update.sh && crontab -e
# Add: */5 * * * * /opt/duckdns/duckdns_update.sh >> /var/log/duckdns.log 2>&1

DOMAIN="v86-64"
TOKEN="YOUR_DUCKDNS_TOKEN_HERE"

echo "$(date): Updating DuckDNS..."
result=$(curl -s "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip=")
echo "Result: $result"

if [ "$result" = "OK" ]; then
    echo "Success"
else
    echo "Failed"
fi
