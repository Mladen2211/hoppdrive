#!/bin/bash
# First-time SSL certificate setup for hoppdrive.ch
# Run this BEFORE the first `docker compose up`

set -e

DOMAIN="hoppdrive.ch"
EMAIL="info@hoppdrive.ch"

echo "==> Starting temporary Nginx for ACME challenge..."

# Start only nginx with a temporary config that serves .well-known
docker compose up -d nginx

echo "==> Requesting certificate from Let's Encrypt..."

docker compose run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  -d "$DOMAIN" \
  -d "www.$DOMAIN"

echo "==> Reloading Nginx with SSL..."
docker compose exec nginx nginx -s reload

echo "==> Done! SSL certificate installed for $DOMAIN"
