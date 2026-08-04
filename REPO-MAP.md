# 🗺️ REPO-MAP — Onde cada arquivo vive e é publicado

> **FONTE DA VERDADE.** Antes de editar/commitar qualquer `.html`, ler isto.
> Regra de ouro: **1 pasta local (este workspace) = fonte de edição. 2 repos de deploy.**
> Nunca commitar um arquivo no repo errado. Publicar sempre via `deploy.sh`.

---

## Os 2 repos (deploy separado)

| Repo GitHub | O que serve | URL pública | PWA |
|-------------|-------------|-------------|-----|
| **GJSTORE** | `index.html` (catálogo/loja) | https://gjstore.github.io/GJSTORE/ | loja instalável |
| **GJSTORE-ADM** | `admin.html` + `gestao_unificada.html` | https://gjstore.github.io/GJSTORE-ADM/admin.html | admin instalável |

Regra de nome: repo com **"ADM"** = painel (admin + gestão). Repo sem = loja (index).

---

## Cada arquivo → repo de destino

| Arquivo | Repo | Observação |
|---------|------|------------|
| `index.html` | GJSTORE | loja pública, cliente |
| `admin.html` | GJSTORE-ADM | painel admin |
| `gestao_unificada.html` | GJSTORE-ADM | gestão operacional (roda no escopo PWA do admin) |
| `config.js` | ambos (cópia própria) | ⚠️ **NÃO unificado** — ver abaixo |
| `sw.js` / `manifest.json` / `icon-*` | GJSTORE | PWA loja |
| `sw-admin.js` → vira `sw.js` | GJSTORE-ADM | PWA admin. Fonte local se chama `sw-admin.js` (SHELL diferente da loja), `deploy.sh` copia renomeando pra `sw.js` — é esse nome que `admin.html` registra. (X6, 2026-08-04: antes `deploy.sh` não tocava nisso, o `sw.js` do repo ADM ficava travado numa cópia manual velha, sem nunca ser atualizado) |
| `mind/`, `gas/`, `REPO-MAP.md`, `deploy.sh` | só workspace | nunca vão pro ar |

Esta pasta local (`GJ STORE/`) é o clone do repo **GJSTORE**. `admin.html` e
`gestao_unificada.html` ficam aqui como **fonte de edição** mas estão no `.gitignore`
deste repo → não sobem no `git push origin`. Vão pro GJSTORE-ADM via `deploy.sh`.

---

## ⚠️ config.js — GAS_URL divergente (PENDENTE de decisão do dono)

Os 2 repos apontam pra **deployments diferentes do MESMO Apps Script** (mesma planilha,
mesmos dados hoje):

- GJSTORE:     `AKfycbz0yOSjdf...`
- GJSTORE-ADM: `AKfycbz9ELiSp5...`

Verificado: `getConfig` e `getProdutos` retornam idêntico nos dois. Funciona, mas é confuso.
**Não unificado automaticamente** — trocar pode reverter código server-side de uma deploy mais
nova. Ação do dono: abrir Apps Script → ver qual é a implantação atual → pôr a mesma URL nos
2 config.js. Até lá, `deploy.sh` **não sincroniza config.js**.

---

## Fluxo de trabalho (qualquer IA)

```
1. Editar o arquivo AQUI (workspace único).
2. Conferir nesta tabela pra qual repo ele vai.
3. Rodar ./deploy.sh  → publica cada arquivo no repo certo.
   NUNCA `git push` cru achando que resolve os dois — resolve só a loja.
```

---

## Erros que ISTO previne (histórico real)

- admin.html/gestao editados e commitados no repo GJSTORE (errado) → live do admin ficou
  30/06→02/07 desatualizado. (resolvido 2026-07-04)
- 3~4 cópias do admin espalhadas (root, subpasta `admin/`, os 2 repos) divergindo.
- recibo do gestao (verde) diferente do index (escuro) por versão presa no repo errado.

→ Ver `mind/decisions.md` P27 | `mind/ARQUITETURA.md`.
