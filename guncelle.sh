#!/bin/sh
# Sunucuda güncelleme: son kodu çekip yeniden derler. Veri (PostgreSQL, kok-pg birimi) korunur.
set -e
cd "$(dirname "$0")"
git pull --ff-only
docker compose up -d --build
docker compose ps
