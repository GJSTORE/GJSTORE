#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GJ STORE — Gerador do catálogo de perfumes (PDF imprimível, A4, 1 perfume/página).
Uso:
  python3 build_catalogo.py [piloto|--nomes "PERFUME A;PERFUME B"] [-o saida.html]
Lê:
  ../data/produtos.json   (produtos ao vivo do GAS)
  ../data/perfume-db.json (pesquisa olfativa: pirâmide, família, inspirado em)
  ../assets/img/<ID>/*.jpg (imagens por produto, manifest IMG_MANIFEST)
Gera: HTML com 1 <section class="page"> por perfume → renderizar via Chrome headless.
"""
import json
import os
import re
import sys
import unicodedata
from urllib.parse import quote

try:
    from PIL import Image
except ImportError:
    Image = None

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(BASE, "data")
IMGDIR = os.path.join(BASE, "assets", "img")
CACHE = os.path.join(IMGDIR, "_cache")
MAXDIM = 1400
MINDIM = 700
JPEGQ = 85


def optimize(src):
    """Gera/retorna versão otimizada (max 1400px, jpeg q85) em _cache."""
    if Image is None:
        return src
    rel = os.path.relpath(src, IMGDIR).replace("/", "_")
    dst = os.path.join(CACHE, rel)
    if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return dst
    im = Image.open(src)
    im.load()
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        bg = Image.new("RGBA", im.size, (250, 246, 238, 255))
        bg.alpha_composite(im)
        im = bg.convert("RGB")
    else:
        im = im.convert("RGB")
    w, h = im.size
    scale = min(1.0, MAXDIM / max(w, h))
    if max(w, h) < MINDIM:
        scale = MINDIM / max(w, h)
    if scale != 1.0:
        im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
    os.makedirs(CACHE, exist_ok=True)
    im.save(dst, "JPEG", quality=JPEGQ, optimize=True, progressive=True)
    return dst


# ---------------------------------------------------------------------------
# manifest de imagens por ID de produto (main, secundária, ...)
# pasta padrão: assets/img/<ID>/ — arquivos descobertos em ordem alfabética
IMG_MANIFEST = {
    "P8524": ["2_extra_amazon.jpg", "1_fornecedor.jpg"],
    "P8478": ["1_fornecedor.jpg", "2_extra_oficial.png"],
    "P8525": ["1_fornecedor.jpg", "2_extra_amazon.jpg"],
    "P8535": ["1_fornecedor.png", "2_extra_amazon.jpg"],
    "P8507": ["1_fornecedor.jpg", "2_extra_amazon.jpg"],
}


def norm(s):
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return s.lower().strip()


# ---------------------------------------------------------------------------
# ICONES DE NOTAS (SVG inline, line art)
ICON_CATS = {
    "citrus": ["limao", "lima", "bergamota", "laranja", "toranja", "mandarina", "tangerina", "pomelo", "cidra", "yuzu", "limao"],
    "fruit": ["fruta", "frutas", "abacaxi", "manga", "maca", "maracuja", "pessego", "ameixa", "pera",
              "uva", "framboesa", "morango", "groselha", "amora", "cereja", "figo", "damasco", "coco",
              "melao", "ruibarbo", "mirtilo", "frutadas", "cristalizadas"],
    "flower": ["rosa", "flor", "flores", "jasmim", "lavanda", "geranio", "tuberosa", "iris", "gardenia",
               "heliotropio", "narciso", "lilas", "peonia", "magnolia", "ylang", "osmanthus", "fresia",
               "violeta", "flor de laranjeira", "flor de cerejeira", "brancas", "floral"],
    "wood": ["madeira", "madeiras", "sandalo", "cedro", "betula", "vetiver", "guaiaco", "patchouli",
             "carvalho", "pau rosa", "palo santo", "cacau", "amadeirada", "amadeirado", "woody"],
    "amber": ["ambar", "ambre", "labdanum", "benjoim", "copahu", "styrax", "ambar cinzento"],
    "vanilla": ["baunilha", "vanilla", "caramelo", "praline", "pralin", "fava tonka", "acucar", "mel",
                "marshmallow", "toffee", "doce", "cremosa", "gourmand", "amendoa", "almendra"],
    "coffee": ["cafe", "chocolate", "cacau", "mocha", "cappuccino", "arabica"],
    "spice": ["especiaria", "especiarias", "canela", "cardamomo", "pimenta", "noz-moscada", "gengibre",
              "acafrao", "cravo", "anis", "cominho", "curcuma", "zimbro", "especiado", "especiada"],
    "musk": ["almiscar", "musk"],
    "herb": ["alecrim", "hortela", "menta", "salvia", "tomilho", "manjericao", "eucalipto", "verbena",
             "camomila", "aromatico", "aromática"],
    "oud": ["oud", "aoud", "agarwood", "agar"],
    "incense": ["incenso", "olibano", "mirra", "myrrh", "elemi", "fumaca", "fumaça", "esfumacada", "defumada"],
    "leather": ["couro", "leather", "camurca"],
    "powder": ["atalcado", "talco", "powder", "atalcada"],
    "aqua": ["aquatico", "agua", "oceanico", "ozonico", "brisa", "salgado", "marinho", "calone"],
    "green": ["verde", "folha", "folhas", "grama", "galbanum", "figo"],
    "tobacco": ["tabaco", "tobacco"],
    "sweet": ["algodao", "bala", "candy", "chiclete", "goma"],
    "floral": ["petala", "botao", "bouquet", "florido"],
}

# ícones alternativos para a mesma nota (n-ésima imagem)
ICON_ALT = {"flower": "floral", "wood": "woody", "vanilla": "sweet"}

ICON_SVGS = {
    "citrus": '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12L6.4 6.4M12 12l5.6-5.6M12 12l0-9M12 12l9 0M12 12l-6 7.5M12 12l6 7.5"/>',
    "fruit": '<path d="M12 8c-4.5-1-8 1-8 6.5S7 21 12 21s8-1 8-6.5S16.5 9 12 8z"/><path d="M12 8V5"/><path d="M12 5c1-2 3-2.5 3.5-2.5"/>',
    "flower": '<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="5" r="3.2"/><circle cx="18.8" cy="9.5" r="3.2"/><circle cx="16.2" cy="16.9" r="3.2"/><circle cx="7.8" cy="16.9" r="3.2"/><circle cx="5.2" cy="9.5" r="3.2"/>',
    "floral": '<path d="M12 21V10"/><path d="M12 10c-4 0-5-3-3.5-5C10 3 12 4.5 12 6c0-1.5 2-3 3.5-1C17 7 16 10 12 10z"/><path d="M12 10c-2.5-.5-4 1-3.5 3 .5 2 3 2.5 3.5 1z"/>',
    "wood": '<path d="M11 12h2v8h-2z"/><circle cx="12" cy="7.5" r="5.2"/><path d="M7.5 9.5c-2 1.5-3.5 3-3.5 5"/><path d="M16.5 9.5c2 1.5 3.5 3 3.5 5"/>',
    "woody": '<rect x="3" y="5" width="18" height="5" rx="1"/><rect x="3" y="14" width="18" height="5" rx="1"/><path d="M6 7.5h3M13 7.5h5M6 16.5h4M14 16.5h4"/>',
    "amber": '<path d="M12 3c4.2 5.2 6.5 8 6.5 11.5a6.5 6.5 0 1 1-13 0C5.5 11 7.8 8.2 12 3z"/><path d="M12 6v13M8.5 12h7"/>',
    "vanilla": '<path d="M4 7.5C10 4 14 4 20 7.5c-.8 4.5-.8 7.5 0 12-6 3.5-10 3.5-16 0 .8-4.5.8-7.5 0-12z"/><path d="M7.5 10.5c2.6 2 5.6 2 9 0"/>',
    "coffee": '<path d="M8 3.5c-2.6 1.5-4 4-3 6.5 1.2 3 3.4 4.5 7 4.5s5.8-1.5 7-4.5c1-2.5-.4-5-3-6.5"/><path d="M12 6.5c-1-1.8-2.6-2.6-4-2.8"/><path d="M6 18c3.5 1.2 8.5 1.2 12 0M6 21c3.5 1.2 8.5 1.2 12 0"/>',
    "spice": '<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>',
    "musk": '<path d="M12 3c3.8 4 5.8 6.5 5.8 9.5a5.8 5.8 0 1 1-11.6 0C6.2 9.5 8.2 7 12 3z"/><path d="M9.5 11.5c.8-.8 1.8-1.2 2.8-1"/>',
    "herb": '<path d="M20 4C12 4 5 9.5 5 16c0 1.2.8 2.2 2 2.4C13 18.5 18 13.5 20 4z"/><path d="M20 4c-3 2-6 5-8 9M13 8c-2.5 2-4.5 5-5.5 8"/>',
    "oud": '<path d="M7 8h10v12H7z"/><path d="M7 8a5 5 0 0 1 10 0"/><path d="M10 11h4M10 14h4M10 17h4"/>',
    "incense": '<path d="M5 21c0-4 4-5 4-8 0-2-1-3-2-3"/><path d="M9 21c0-3.5 3-4 3-7 0-1.5-.8-2.5-1.8-2.5"/><path d="M13 21c0-4 3.5-4 3.5-8 0-1.5-.8-2.3-1.7-2.3"/>',
    "leather": '<path d="M4 8.5h16v8H4z"/><path d="M4 12.5h4"/><path d="M14 12.5h6"/><path d="M6 8.5v8M18 8.5v8"/>',
    "powder": '<path d="M12 3c3 1 4.5 3 4.5 5.5C16.5 10 14.5 11 12 11s-4.5-1-4.5-2.5C7.5 6 9 4 12 3z"/><path d="M8 11c0 1.5 1.8 2.2 4 2.2s4-.7 4-2.2"/><path d="M10 14.5c0 1.5 1 2.5 2 2.5s2-1 2-2.5"/>',
    "aqua": '<path d="M3 10c3 3 6-3 9 0s6-3 9 0M3 15c3 3 6-3 9 0s6-3 9 0"/>',
    "green": '<path d="M12 21V8"/><path d="M12 8C12 4 9.5 3 6 3c0 4 2 6 6 6zM12 12c0-4 2.5-5.5 6-5.5 0 4-2.5 6-6 5.5z"/>',
    "tobacco": '<path d="M5 16c0-8 5-12 13-12-1 8-5 12-13 12z"/><path d="M5 19c3 1 7 1 10-1"/>',
    "sweet": '<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M9 8.5c0-1.5 1.5-2 2-1M14 6c0-1.5-1-2.5-2-2"/>',
    "temp": '<path d="M12 2a2 2 0 0 1 2 2v9.2a4 4 0 0 1-4 0V4a2 2 0 0 1 2-2z"/><path d="M12 9v4"/><path d="M9.5 13a2.5 2.5 0 1 0 5 0"/>',
}


def note_icon(note, used=None):
    n = norm(note)
    used = used or set()
    for cat, keys in ICON_CATS.items():
        for k in keys:
            if n == k or (" " + k + " ") in (" " + n + " ") or n.startswith(k):
                icon = ICON_ALT.get(cat, cat)
                if icon in used:
                    icon = cat
                return icon
    return "flower"


# ---------------------------------------------------------------------------
# CSS
CSS = """
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Open Sans', 'DejaVu Sans', sans-serif; color: #241d13; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

.page {
  width: 210mm; height: 297mm; position: relative; overflow: hidden;
  background: #faf6ee; padding: 0 14mm;
  display: flex; flex-direction: column;
  page-break-after: always;
}
.page:last-child { page-break-after: auto; }

.topline { height: 2.2mm; background: linear-gradient(90deg,#b8892f,#e3c887 55%,#b8892f); margin: 0 -14mm; }
.topline-sub { height: 0.4mm; background: #d8bc7f; margin: 1mm 0 0 -14mm; }

header { padding: 9mm 0 5mm; position: relative; }
.brand {
  font-family: 'Montserrat', sans-serif; font-weight: 700; letter-spacing: 0.42em;
  font-size: 13pt; color: #b8892f; text-transform: uppercase;
}
.brand-sub { font-family: 'Open Sans', sans-serif; font-weight: 600; letter-spacing: 0.25em; font-size: 7.5pt; color: #9c8a5f; margin-top: 1mm; }
h1 {
  font-family: 'Noto Serif', 'Liberation Serif', serif; font-weight: 600;
  font-size: 30pt; line-height: 1.08; margin: 2.5mm 0 0; color: #241d13; letter-spacing: 0.005em;
}
.meta-line { margin-top: 2.5mm; font-family: 'Montserrat', sans-serif; font-size: 8.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: #7a6f58; }
.meta-line b { color: #b8892f; }

.watermark { position: absolute; right: 0; top: 8mm; font-family: 'Noto Serif', serif; font-size: 52pt; color: #efe6d2; z-index: 0; }
header, .stage, .specs, footer { position: relative; z-index: 2; }

.stage { display: flex; gap: 8mm; flex: 1 1 auto; min-height: 0; }
.hero { width: 55%; display: flex; flex-direction: column; align-items: center; }
.frame-main {
  width: 100%; flex: 1 1 auto; min-height: 0; position: relative;
  background: radial-gradient(120% 90% at 50% 30%, #ffffff 40%, #f4ebd8 100%);
  border: 1px solid #e5d5b0; border-radius: 3mm;
  display: flex; align-items: center; justify-content: center; padding: 4mm;
}
.frame-main img { max-width: 92%; max-height: 100%; object-fit: contain;  }
.insp {
  margin-top: 4mm; width: 100%;
  border: 1px solid #c9a24b; border-radius: 2.2mm; background: #fffaf0;
  padding: 2.6mm 3mm; text-align: center;
}
.insp-label { font-family: 'Montserrat', sans-serif; font-size: 7pt; letter-spacing: 0.3em; color: #b8892f; }
.insp-name { font-family: 'Noto Serif', serif; font-size: 12.5pt; font-weight: 600; color: #241d13; margin-top: 0.6mm; }
.thumbs { display: flex; gap: 3mm; margin-top: 3.5mm; width: 100%; }
.thumbs .thumb {
  width: 42%; aspect-ratio: 4 / 3.4; border: 1px solid #e5d5b0; border-radius: 2mm;
  background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 1.5mm;
}
.thumbs .thumb img { max-width: 96%; max-height: 96%; object-fit: contain; }
.thumbs .thumb:first-child { margin-left: 0; }
.thumbs .thumb.spacer { visibility: hidden; }

.side { width: 45%; display: flex; flex-direction: column; gap: 3.6mm; min-height: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 1.8mm; }
.badge {
  font-family: 'Montserrat', sans-serif; font-size: 7pt; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #6b5a33; background: #f1e7cd; border: 1px solid #ddc893;
  border-radius: 10mm; padding: 1.4mm 3mm;
}
.badge.strong { color: #fff; background: linear-gradient(135deg,#b8892f,#8a6a22); border-color: #8a6a22; }

.desc {
  font-size: 9.3pt; line-height: 1.5; color: #3a3125; margin: 0; text-align: justify; hyphens: auto;
}
.desc .lead { color: #b8892f; font-weight: 700; }

.pyramid {
  background: #fff; border: 1px solid #e5d5b0; border-radius: 2.6mm; padding: 3mm 3mm 2.5mm; flex: 0 0 auto;
}
.py-title { font-family: 'Montserrat', sans-serif; font-size: 7pt; letter-spacing: 0.3em; color: #b8892f; text-align: center; margin-bottom: 2.2mm; }
.py-row { display: flex; align-items: flex-start; gap: 2.5mm; padding: 1.7mm 0; border-top: 1px dashed #eadcbd; }
.py-row:first-of-type { border-top: none; }
.py-label {
  font-family: 'Montserrat', sans-serif; font-size: 6.6pt; font-weight: 700; letter-spacing: 0.14em;
  writing-mode: horizontal-tb; min-width: 13mm; color: #8a6a22; text-transform: uppercase; padding-top: 0.8mm;
}
.py-chips { display: flex; flex-wrap: wrap; gap: 1.4mm; }
.chip {
  display: inline-flex; align-items: center; gap: 1.2mm;
  font-size: 7.4pt; color: #3a3125; background: #f8f2e4; border: 1px solid #e3d3a9;
  border-radius: 1.6mm; padding: 0.9mm 2mm 0.9mm 1.4mm; font-weight: 600;
}
.chip svg { width: 3.4mm; height: 3.4mm; color: #b8892f; flex: 0 0 auto; }
.py-row.top .chip { background: #fdf6e0; border-color: #ecd9a4; }
.py-row.heart .chip { background: #f9ecf0; border-color: #e7c7cf; }
.py-row.heart .chip svg { color: #c25b6e; }
.py-row.base .chip { background: #f0e9dd; border-color: #d5c3a4; }
.py-row.base .chip svg { color: #6d4a2a; }

.perf-grid { display: flex; gap: 2.2mm; }
.perf-cell {
  flex: 1; background: #fff; border: 1px solid #e5d5b0; border-radius: 2mm; padding: 2mm 2.4mm;
  text-align: center;
}
.perf-cell .k { font-family: 'Montserrat', sans-serif; font-size: 6.4pt; letter-spacing: 0.18em; color: #9c8a5f; }
.perf-cell .v { font-size: 9.5pt; font-weight: 700; color: #241d13; margin-top: 0.8mm; }

.quando {
  display: flex; align-items: center; gap: 4mm;
  background: linear-gradient(135deg, #fffaf0, #f6ecd6);
  border: 1.2px solid #c9a24b; border-left: 3.2mm solid #b8892f;
  border-radius: 2.6mm; padding: 3mm 4mm; margin: 0 0 4mm;
}
.quando svg { width: 9mm; height: 9mm; color: #b8892f; flex: 0 0 auto; }
.quando-titulo { font-family: 'Montserrat', sans-serif; font-size: 7.5pt; font-weight: 700; letter-spacing: 0.3em; color: #8a6a22; }
.quando-texto { font-size: 9.3pt; line-height: 1.5; color: #3a3125; margin-top: 0.8mm; text-align: justify; }

.specs {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px;
  background: #e5d5b0; border: 1px solid #e5d5b0; border-radius: 2.4mm; overflow: hidden; margin: 4mm 0 3mm;
}
.spec { background: #fffdf7; padding: 2.2mm 3mm; display: flex; flex-direction: column; gap: 0.6mm; }
.spec .k { font-family: 'Montserrat', sans-serif; font-size: 6.2pt; letter-spacing: 0.2em; color: #9c8a5f; text-transform: uppercase; }
.spec .v { font-size: 8.6pt; font-weight: 700; color: #241d13; }

footer {
  display: flex; justify-content: space-between; align-items: center;
  padding: 2.5mm 0 4mm; border-top: 0.4mm solid #d8bc7f;
  font-family: 'Montserrat', sans-serif; font-size: 7pt; letter-spacing: 0.22em; color: #9c8a5f;
}
footer .pageno { color: #b8892f; font-weight: 700; }
"""

# ---------------------------------------------------------------------------
# DADOS


def load():
    prods = json.load(open(os.path.join(DATA, "produtos.json"), encoding="utf-8"))["perfumes"]
    db = json.load(open(os.path.join(DATA, "perfume-db.json"), encoding="utf-8"))["perfumes"]
    return prods, db


def chip_html(note, used):
    icon = note_icon(note, used)
    used.add(icon)
    return '<span class="chip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#i-%s"/></svg>%s</span>' % (icon, note)


def page_html(p, r, idx, total, imgdir):
    nome = p["Nome do Produto"]
    marca = (r or {}).get("marca") or "Perfume Árabe"
    genero = (r or {}).get("genero") or "—"
    familia = (r or {}).get("familia") or "—"
    insp = (r or {}).get("inspirado_em")
    conc = (r or {}).get("concentracao") or "EDP"
    vol = (r or {}).get("volume") or "100ml"
    ano = (r or {}).get("ano") or "—"
    fix = (r or {}).get("fixacao") or "—"
    sil = (r or {}).get("silagem") or "—"
    desc = (r or {}).get("descricao") or (p.get("Descrição") or "").lstrip("🌟✨🔥🌹🍫🥃☕🕌🍓💜🌿⭐🏔️🎉👑🥈🕊️⚡🩷🤍💙 ")
    desc = re.sub(r"^[^\wÀ-ÿ]{1,4}\s*", "", desc)
    saida = r.get("notas_saida") or []
    coracao = r.get("notas_coracao") or []
    fundo = r.get("notas_fundo") or []
    quando = r.get("quando_usar") or ""

    # imagens
    files = IMG_MANIFEST.get(p["ID"], [])
    pdir = os.path.join(IMGDIR, p["ID"])
    imgs = []
    if os.path.isdir(pdir):
        have = sorted(os.listdir(pdir))
        for fn in files + have:
            if fn in have and fn not in imgs:
                imgs.append(fn)
    imgs = [os.path.join(pdir, fn) for fn in imgs]
    if not imgs:
        imgs = ["https://via.placeholder.com/600x700?text=sem+imagem"]
    for i in range(len(imgs)):
        imgs[i] = "file://" + quote(os.path.abspath(optimize(imgs[i])))

    main = imgs[0]
    secs = imgs[1:3]
    thumbs = ""
    if secs:
        for s in secs:
            thumbs += '<div class="thumb"><img src="%s"></div>' % s

    used = set()
    s_chips = "".join(chip_html(n, used) for n in saida)
    c_chips = "".join(chip_html(n, used) for n in coracao)
    f_chips = "".join(chip_html(n, used) for n in fundo)

    pageno = "%02d" % idx
    insp_html = ""
    if insp:
        insp_html = (
            '<div class="insp"><div class="insp-label">INSPIRADO EM</div>'
            '<div class="insp-name">%s</div></div>' % insp
        )
    quando_html = ""
    if quando:
        quando_html = (
            '<div class="quando"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
            'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><use href="#i-temp"/></svg>'
            '<div><div class="quando-titulo">QUANDO USAR</div>'
            '<div class="quando-texto">%s</div></div></div>' % quando
        )

    return f"""
<section class="page">
  <div class="topline"></div>
  <div class="topline-sub"></div>
  <header>
    <div class="watermark">{idx:02d}</div>
    <div class="brand">{marca}</div>
    <div class="brand-sub">PERFUME ÁRABE · EAU DE PARFUM</div>
    <h1>{nome}</h1>
    <div class="meta-line">{conc} · <b>{genero}</b> · {familia}</div>
  </header>

  <div class="stage">
    <div class="hero">
      <div class="frame-main"><img src="{main}"></div>
      {insp_html}
      <div class="thumbs">{thumbs}</div>
    </div>

    <div class="side">
      <div class="chips">
        <span class="badge strong">{genero}</span>
        <span class="badge">{conc}</span>
        <span class="badge">{vol}</span>
        <span class="badge">Lançado {ano}</span>
      </div>
      <p class="desc"><span class="lead">{marca}</span> — {desc}</p>

      <div class="pyramid">
        <div class="py-title">PIRÂMIDE OLFATIVA</div>
        <div class="py-row top"><div class="py-label">Saída</div><div class="py-chips">{s_chips}</div></div>
        <div class="py-row heart"><div class="py-label">Coração</div><div class="py-chips">{c_chips}</div></div>
        <div class="py-row base"><div class="py-label">Fundo</div><div class="py-chips">{f_chips}</div></div>
      </div>

      <div class="perf-grid">
        <div class="perf-cell"><div class="k">FIXAÇÃO</div><div class="v">{fix}</div></div>
        <div class="perf-cell"><div class="k">SILAGEM</div><div class="v">{sil}</div></div>
      </div>
    </div>
  </div>

  {quando_html}

  <div class="specs">
    <div class="spec"><div class="k">Marca</div><div class="v">{marca}</div></div>
    <div class="spec"><div class="k">Família olfativa</div><div class="v">{familia}</div></div>
    <div class="spec"><div class="k">Concentração</div><div class="v">{conc}</div></div>
    <div class="spec"><div class="k">Volume</div><div class="v">{vol}</div></div>
    <div class="spec"><div class="k">Gênero</div><div class="v">{genero}</div></div>
    <div class="spec"><div class="k">Ano de lançamento</div><div class="v">{ano}</div></div>
    <div class="spec"><div class="k">Fixação</div><div class="v">{fix}</div></div>
    <div class="spec"><div class="k">Silagem</div><div class="v">{sil}</div></div>
  </div>

  <footer><span>CATÁLOGO · PERFUMES ÁRABES</span><span class="pageno">{pageno} / {total:02d}</span></footer>
</section>
"""


def svg_defs():
    parts = []
    for name, body in ICON_SVGS.items():
        parts.append('<symbol id="i-%s" viewBox="0 0 24 24">%s</symbol>' % (name, body))
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">%s</svg>' % "".join(parts)


def build(perfumes, db):
    pages = []
    n = len(perfumes)
    for i, p in enumerate(perfumes, 1):
        r = db.get(p["Nome do Produto"]) or {}
        pages.append(page_html(p, r, i, n, IMGDIR))
    return (
        "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
        "<style>" + CSS + "</style></head><body>"
        + svg_defs()
        + "".join(pages)
        + "</body></html>"
    )


def main():
    prods, db = load()
    args = sys.argv[1:]
    if args and args[0] == "piloto":
        nomes = ["CLUB DE NUIT INTENSE", "YARA TOUS", "ASAD BOURBON", "KHAMRAH QAHWAH", "LIQUID BRUN"]
        html = build([p for p in prods if p["Nome do Produto"] in nomes], db)
    elif args and args[0] == "--nomes":
        nomes = [x.strip() for x in args[1].split(";") if x.strip()]
        html = build([p for p in prods if p["Nome do Produto"] in nomes], db)
    else:
        html = build(prods, db)
    out = os.path.join(BASE, "build", "catalogo.html")
    if args and args[0] == "piloto":
        out = os.path.join(BASE, "piloto", "catalogo_piloto.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print("HTML gerado:", out, "|", len(re.findall(r'class="page"', html)), "páginas")


if __name__ == "__main__":
    main()
