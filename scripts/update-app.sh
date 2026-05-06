#!/usr/bin/env bash
# DEPLOY/scripts/update-app.sh
#
# Workflow de mise à jour quotidien : git pull → rebuild → migrate.
# À copier sur le VPS dans ~/apps/maya-couture/scripts/ après le 1er
# déploiement, ou à lancer depuis n'importe où via chemin absolu.
#
# Usage (en tant que `maya`) :
#   cd ~/apps/maya-couture
#   ./scripts/update-app.sh

set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/apps/maya-couture}"
cd "$APP_DIR"

echo "═══════════════════════════════════════════════════════════════"
echo "  Maya Couture · Update"
echo "═══════════════════════════════════════════════════════════════"

# ─── 1. Git pull ───────────────────────────────────────────────────────
echo ">> [1/4] git pull…"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin "$BRANCH"
LOCAL="$(git rev-parse "@")"
REMOTE="$(git rev-parse "@{u}")"
if [ "$LOCAL" = "$REMOTE" ]; then
  echo "   Déjà à jour (HEAD = $LOCAL)"
  read -rp "   Forcer le rebuild quand même ? [y/N] " force
  [[ "$force" =~ ^[yY] ]] || exit 0
else
  git pull
fi

# ─── 2. Détection si le schéma a changé ───────────────────────────────
SCHEMA_CHANGED=false
if git diff "$LOCAL" HEAD -- prisma/schema.prisma 2>/dev/null | grep -q '^[+-]'; then
  SCHEMA_CHANGED=true
fi

# ─── 3. Rebuild + restart ──────────────────────────────────────────────
echo
echo ">> [2/4] Rebuild conteneur app…"
docker compose up -d --build app

echo
echo ">> [3/4] Attente démarrage app (max 60s)…"
for i in $(seq 1 30); do
  if docker compose ps app --format json 2>/dev/null | grep -q '"State":"running"'; then
    break
  fi
  sleep 2
done

# ─── 4. Migrations Prisma ──────────────────────────────────────────────
echo
echo ">> [4/4] Migrations Prisma…"
if [ "$SCHEMA_CHANGED" = "true" ]; then
  echo "   Schéma modifié → prisma db push"
  docker compose exec -T app npx prisma db push --skip-generate
else
  echo "   Schéma inchangé → skip"
  read -rp "   Forcer prisma db push ? [y/N] " force_push
  if [[ "$force_push" =~ ^[yY] ]]; then
    docker compose exec -T app npx prisma db push --skip-generate
  fi
fi

# ─── Healthcheck final ─────────────────────────────────────────────────
echo
echo ">> Healthcheck :"
docker compose ps

echo
echo "✓ Update terminé."
echo "  Logs : docker compose logs -f app"
echo
