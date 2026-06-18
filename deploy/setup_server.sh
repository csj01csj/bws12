#!/bin/bash
# Run on server: 119.196.25.58
# Usage: bash setup_server.sh YOUR_DUCKDNS_TOKEN

set -e

TOKEN=$1
if [ -z "$TOKEN" ]; then
    echo "Usage: $0 <duckdns_token>"
    echo "Get token from: https://www.duckdns.org/"
    exit 1
fi

echo "=== Installing Nginx ==="
apt-get update -qq
apt-get install -y nginx curl

echo "=== Setting up v86 site directory ==="
mkdir -p /var/www/v86/images
mkdir -p /var/www/v86/bios

echo "=== Copying site files ==="
# Copy built v86 files (run 'make all' first in the repo)
# cp -r /path/to/bws12/build/* /var/www/v86/
# cp /path/to/bws12/*.html /var/www/v86/
# cp /path/to/bws12/*.js /var/www/v86/
# cp /path/to/bws12/*.css /var/www/v86/

echo "=== Installing Nginx config ==="
cp nginx.conf /etc/nginx/sites-available/v86
ln -sf /etc/nginx/sites-available/v86 /etc/nginx/sites-enabled/v86
rm -f /etc/nginx/sites-enabled/default

nginx -t && systemctl reload nginx

echo "=== Setting up DuckDNS updater ==="
mkdir -p /opt/duckdns
sed "s/YOUR_DUCKDNS_TOKEN_HERE/$TOKEN/" duckdns_update.sh > /opt/duckdns/duckdns_update.sh
chmod +x /opt/duckdns/duckdns_update.sh

# Add cron job (every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /opt/duckdns/duckdns_update.sh >> /var/log/duckdns.log 2>&1") | crontab -

echo "=== Running first DuckDNS update ==="
/opt/duckdns/duckdns_update.sh

echo "=== Done! Site will be at: http://v86-64.duckdns.org ==="
