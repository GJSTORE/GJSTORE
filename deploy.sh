#!/usr/bin/env bash
# deploy.sh — publica cada arquivo no repo certo (ver REPO-MAP.md)
# Uso: GH_TOKEN=ghp_... ./deploy.sh "mensagem de commit"
# Requer: GH_TOKEN definido como variável de ambiente (NUNCA embutir neste arquivo).
set -euo pipefail

MSG="${1:-deploy: sync $(date +%F_%H%M)}"
HERE="$(cd "$(dirname "$0")" && pwd)"
GH_TOKEN="${GH_TOKEN:-}"
if [ -z "$GH_TOKEN" ]; then
  echo "ERRO: defina GH_TOKEN antes de rodar. Ex: GH_TOKEN=ghp_... ./deploy.sh"
  exit 1
fi
ADM_REPO="https://${GH_TOKEN}@github.com/GJSTORE/GJSTORE-ADM.git"
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
# sw-admin.js é a fonte local; no repo ADM precisa se chamar sw.js (admin.html registra
# "./sw.js" — X6: antes disso não existia, sw.js do ADM ficava travado numa cópia manual velha)
cp "$HERE/sw-admin.js"           "$TMP/ADM/sw.js"
# config.js NÃO é copiado: GAS_URL diverge de propósito (ver REPO-MAP.md).
cd "$TMP/ADM"
# clone temporário não herda identidade git — sem isso o commit falha com "Author identity unknown"
git config user.name "$(cd "$HERE" && git config user.name || echo GJSTORE)"
git config user.email "$(cd "$HERE" && git config user.email || echo deploy@gjstore.local)"
git add admin.html gestao_unificada.html sw.js
if ! git diff --cached --quiet; then
  git commit -m "$MSG"
  git push origin main
  echo "    admin publicado: https://gjstore.github.io/GJSTORE-ADM/admin.html"
else
  echo "    admin sem mudanças."
fi

echo "==> OK. Ver REPO-MAP.md."
