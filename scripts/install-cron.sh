#!/usr/bin/env bash
# scripts/install-cron.sh
#
# Installe les entrées crontab de Maya Couture (briefings + récap email).
# À exécuter une fois sur l'hôte qui tourne docker compose.
#
# Ce script :
#   1. crée /etc/maya-couture.env (interactif) avec MAYA_BASE_URL + CRON_SECRET
#   2. crée /var/log/maya-cron.log writable par l'utilisateur courant
#   3. ajoute 4 lignes au crontab de l'utilisateur courant :
#        - 08:00  briefing matin (départs/retours du jour)
#        - 18:00  briefing soir (récap voicy demain)
#        - 18:30  alerte cautions en retard
#        - 20:00  récap email à toute l'équipe
#
# Usage :
#   chmod +x scripts/cron-recap.sh scripts/install-cron.sh
#   sudo ./scripts/install-cron.sh

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CRON_SCRIPT="${REPO_DIR}/scripts/cron-recap.sh"
CONF="/etc/maya-couture.env"
LOG="/var/log/maya-cron.log"

if [ "$EUID" -ne 0 ] && [ ! -w "$(dirname "$CONF")" ]; then
  echo "Ce script doit être lancé en sudo (pour écrire $CONF et $LOG)." >&2
  exit 1
fi

if [ ! -f "$CRON_SCRIPT" ]; then
  echo "Introuvable : $CRON_SCRIPT" >&2
  exit 1
fi
chmod +x "$CRON_SCRIPT"

# ─── 1. Config ──────────────────────────────────────────────────────────────
if [ -f "$CONF" ]; then
  echo "$CONF existe déjà. Aperçu :"
  cat "$CONF"
  read -rp "Réécrire ? [y/N] " yn
  case "$yn" in [yY]*) ;; *) echo "Conservé." ;; esac
fi

if [ ! -f "$CONF" ] || [[ "${yn:-}" =~ ^[yY] ]]; then
  read -rp "MAYA_BASE_URL (ex: https://maya.tail-xxxx.ts.net) : " URL
  read -rsp "CRON_SECRET (la valeur dans .env) : " SECRET
  echo
  cat > "$CONF" <<EOF
# Configuration Maya Couture pour les tâches cron
# Lu par scripts/cron-recap.sh
MAYA_BASE_URL="${URL}"
CRON_SECRET="${SECRET}"
EOF
  chmod 640 "$CONF"
  echo "Écrit : $CONF (mode 640)"
fi

# ─── 2. Log file ────────────────────────────────────────────────────────────
if [ ! -f "$LOG" ]; then
  touch "$LOG"
  chmod 664 "$LOG"
  echo "Créé : $LOG"
fi

# ─── 3. Crontab ─────────────────────────────────────────────────────────────
TARGET_USER="${SUDO_USER:-$USER}"
echo "Installation des entrées crontab pour l'utilisateur : $TARGET_USER"

# On préserve les lignes existantes qui n'appartiennent pas à Maya, on remplace
# notre bloc identifié par le marqueur "# maya-couture cron".
TMP="$(mktemp)"
crontab -u "$TARGET_USER" -l 2>/dev/null | grep -v "# maya-couture cron" > "$TMP" || true

cat >> "$TMP" <<EOF
# maya-couture cron — briefings + récap email (auto-installés)
0  8 * * * ${CRON_SCRIPT} morning      # maya-couture cron
0 18 * * * ${CRON_SCRIPT} evening      # maya-couture cron
30 18 * * * ${CRON_SCRIPT} deposits    # maya-couture cron
0 20 * * * ${CRON_SCRIPT} email-recap  # maya-couture cron
EOF

crontab -u "$TARGET_USER" "$TMP"
rm -f "$TMP"

echo
echo "✓ Crontab installé. Pour vérifier :"
echo "  crontab -u $TARGET_USER -l"
echo
echo "Logs des exécutions : $LOG"
echo "Test manuel d'une tâche (sans attendre l'horaire) :"
echo "  $CRON_SCRIPT email-recap"
