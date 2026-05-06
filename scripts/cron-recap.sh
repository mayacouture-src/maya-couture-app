#!/usr/bin/env bash
# scripts/cron-recap.sh
#
# Tape les tâches cron de l'app Maya Couture (briefings + récap email).
# À installer via crontab sur l'hôte qui tourne docker compose.
#
# Variables attendues (à exporter avant l'appel, ou définies dans
# /etc/maya-couture.env — voir le bas du fichier) :
#   MAYA_BASE_URL    URL publique de l'app (ex: https://maya.tail-xxxx.ts.net
#                    en Phase 0, ou https://app.tondomain.fr en prod)
#   CRON_SECRET      secret qui matche celui défini dans .env
#
# Tâches disponibles : morning | evening | deposits | email-recap | all
#
# Usage :
#   ./scripts/cron-recap.sh morning
#   ./scripts/cron-recap.sh email-recap
#
# Logs :
#   Tout est écrit en append dans /var/log/maya-cron.log (créer le fichier et
#   le rendre writable par l'utilisateur du cron au préalable).

set -euo pipefail

# ─── Charge la config si présente ───────────────────────────────────────────
CONF="/etc/maya-couture.env"
if [ -f "$CONF" ]; then
  # shellcheck disable=SC1090
  source "$CONF"
fi

# ─── Validation ─────────────────────────────────────────────────────────────
TASK="${1:-}"
if [ -z "$TASK" ]; then
  echo "Usage: $0 <morning|evening|deposits|email-recap|all>" >&2
  exit 2
fi

case "$TASK" in
  morning|evening|deposits|email-recap|all) ;;
  *) echo "Tâche inconnue: $TASK" >&2; exit 2 ;;
esac

if [ -z "${MAYA_BASE_URL:-}" ] || [ -z "${CRON_SECRET:-}" ]; then
  echo "MAYA_BASE_URL et CRON_SECRET doivent être exportés (ou dans $CONF)" >&2
  exit 2
fi

LOG_FILE="${MAYA_LOG:-/var/log/maya-cron.log}"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

# ─── Appel ──────────────────────────────────────────────────────────────────
URL="${MAYA_BASE_URL%/}/api/cron/run?task=${TASK}"

# -s : silent
# -S : montrer les erreurs malgré -s
# -f : exit code != 0 si HTTP >= 400
# --max-time 60 : timeout 60s (l'agrégation peut prendre du temps si beaucoup de données)
# header pour passer le secret (plutôt que dans la query string, plus discret dans les logs)
RESPONSE=$(curl -sSf --max-time 60 \
  -H "x-cron-secret: ${CRON_SECRET}" \
  "${URL}" 2>&1) || {
    echo "[$TS] ERROR task=$TASK : $RESPONSE" >> "$LOG_FILE"
    exit 1
  }

echo "[$TS] OK task=$TASK : $RESPONSE" >> "$LOG_FILE"
