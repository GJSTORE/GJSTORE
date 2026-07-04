#!/usr/bin/env bash
# deploy.sh — publica cada arquivo no repo certo (ver REPO-MAP.md)
# Uso: ./deploy.sh "mensagem de commit"
# Requer: git com credencial já configurada (gh auth login OU credential helper).
#         NUNCA embutir token neste arquivo.
set -euo pipefail

MSG="${1:-deploy: sync $(date +%F_%H%M)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
ADM_REPO="https://github.com/GJSTORE/GJSTORE-ADM.git"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> [1/2] LOJA (GJSTORE) — só arquivos rastreados (index, config, sw, manifest, icons)"
cd "$HERE"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "$MSG"
fi
git push origin main
echo "    loja publicada: https://gjstore.github.io/GJSTORE/"

echo "==> [2/2] ADMIN (GJSTORE-ADM) — admin.html + gestao_unificada.html"
git clone --depth 1 "$ADM_REPO" "$TMP/ADM"
cp "$HERE/admin.html"            "$TMP/ADM/admin.html"
cp "$HERE/gestao_unificada.html" "$TMP/ADM/gestao_unificada.html"
# config.js NÃO é copiado: GAS_URL diverge de propósito (ver REPO-MAP.md).
cd "$TMP/ADM"
git add admin.html gestao_unificada.html
if ! git diff --cached --quiet; then
  git commit -m "$MSG"
  git push origin main
  echo "    admin publicado: https://gjstore.github.io/GJSTORE-ADM/admin.html"
else
  echo "    admin sem mudanças."
fi

echo "==> OK. Ver REPO-MAP.md."
