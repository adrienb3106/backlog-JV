#!/bin/sh
set -e

echo "⬇️  Pull des dernières modifications..."
git pull

echo "🔨 Rebuild et redémarrage du conteneur..."
docker-compose down
docker-compose up -d --build

echo "✅ Mis à jour. App dispo sur http://localhost:4001"
