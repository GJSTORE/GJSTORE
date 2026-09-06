#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GJ STORE — Gerador do catálogo de smartphones (HTML imprimível, A4, 1 aparelho/página).
Mirror de build_catalogo.py (perfumes), adaptado para smartphones.

Uso:
  python3 build_catalogo_smartphones.py            # gera as 5 marcas
  python3 build_catalogo_smartphones.py MOTOROLA    # gera so uma marca

Le:
  ../data/smartphone-db.json  (unica fonte de dados — sem live produtos.json)
  ../assets/img/smartphones/<marca-slug>/<modelo-slug>/*.jpg

Gera (em catalogo/, ao lado de Catalogo_GJ_STORE_78_perfumes.html):
  Catalogo_GJ_STORE_Motorola.html
  Catalogo_GJ_STORE_Samsung.html
  Catalogo_GJ_STORE_Xiaomi_Redmi.html
  Catalogo_GJ_STORE_Poco.html
  Catalogo_GJ_STORE_Realme.html

Nao depende de Chrome/headless — apenas gera o HTML (ver README/relatorio da sessao
para a limitacao de nao haver Chromium instalado neste ambiente p/ print-to-pdf).
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
IMGDIR = os.path.join(BASE, "assets", "img", "smartphones")
CACHE = os.path.join(BASE, "assets", "img", "_cache_smartphones")
MAXDIM = 1400
MINDIM = 700
JPEGQ = 85

BRAND_SLUG = {
    "MOTOROLA": "motorola",
    "SAMSUNG": "samsung",
    "XIAOMI_REDMI": "xiaomi-redmi",
    "POCO": "poco",
    "REALME": "realme",
}
BRAND_FILE = {
    "MOTOROLA": "Motorola",
    "SAMSUNG": "Samsung",
    "XIAOMI_REDMI": "Xiaomi_Redmi",
    "POCO": "Poco",
    "REALME": "Realme",
}
BRAND_DISPLAY = {
    "MOTOROLA": "Motorola",
    "SAMSUNG": "Samsung",
    "XIAOMI_REDMI": "Xiaomi / Redmi",
    "POCO": "Poco",
    "REALME": "Realme",
}


def slugify(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def optimize(src):
    """Gera/retorna versao otimizada (max 1400px, jpeg q85) em cache dedicado."""
    if Image is None:
        return src
    rel = os.path.relpath(src, IMGDIR).replace("/", "_").replace(os.sep, "_")
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
# ICONES (SVG inline, line art) — specs de smartphone
ICON_SVGS = {
    "tela": '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 21h6"/>',
    "bateria": '<rect x="3" y="8" width="16" height="8" rx="1.5"/><path d="M21 10.5v3"/><path d="M6 8v8M9 8v8" opacity="0"/>',
    "camera": '<path d="M4 8h3l1.5-2h7L17 8h3v11H4z"/><circle cx="12" cy="13.5" r="3.4"/>',
    "chip": '<rect x="7" y="7" width="10" height="10" rx="1.2"/><path d="M9 3v3M12 3v3M15 3v3M9 18v3M12 18v3M15 18v3M3 9h3M3 12h3M3 15h3M18 9h3M18 12h3M18 15h3"/>',
    "armazenamento": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 4v4h8V4"/><circle cx="12" cy="14" r="2.2"/>',
    "ram": '<rect x="3" y="9" width="18" height="7" rx="1.2"/><path d="M6 9V6M10 9V6M14 9V6M18 9V6M6 16v3M10 16v3M14 16v3M18 16v3"/>',
    "preco": '<circle cx="12" cy="12" r="9"/><path d="M12 6.5v11M15 9.2c0-1.4-1.3-2.2-3-2.2s-3 .9-3 2.3 1.3 1.9 3 2.2c1.7.3 3 .8 3 2.2s-1.3 2.3-3 2.3-3-.8-3-2.2"/>',
    "kit": '<path d="M4 8h16v11H4z"/><path d="M4 8l3-4h10l3 4"/><path d="M12 8v11" opacity="0"/>',
    "temp": '<path d="M12 2a2 2 0 0 1 2 2v9.2a4 4 0 0 1-4 0V4a2 2 0 0 1 2-2z"/><path d="M12 9v4"/><path d="M9.5 13a2.5 2.5 0 1 0 5 0"/>',
}


def svg_defs():
    parts = []
    for name, body in ICON_SVGS.items():
        parts.append('<symbol id="i-%s" viewBox="0 0 24 24">%s</symbol>' % (name, body))
    return '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">%s</svg>' % "".join(parts)


def icon(name):
    return ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            'stroke-linecap="round" stroke-linejoin="round"><use href="#i-%s"/></svg>') % name


# ---------------------------------------------------------------------------
# CSS — mesma identidade visual dourada/luxo do catalogo de perfumes, com
# a piramide olfativa substituida por um bloco de specs tecnicas.
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
  font-size: 27pt; line-height: 1.1; margin: 2.5mm 0 0; color: #241d13; letter-spacing: 0.005em;
}
.meta-line { margin-top: 2.5mm; font-family: 'Montserrat', sans-serif; font-size: 8.5pt; letter-spacing: 0.12em; text-transform: uppercase; color: #7a6f58; }
.meta-line b { color: #b8892f; }

.watermark { position: absolute; right: 0; top: 8mm; font-family: 'Noto Serif', serif; font-size: 52pt; color: #efe6d2; z-index: 0; }
header, .stage, .specs, footer { position: relative; z-index: 2; }

.stage { display: flex; gap: 8mm; flex: 1 1 auto; min-height: 0; }
.hero { width: 52%; display: flex; flex-direction: column; align-items: center; }
.frame-main {
  width: 100%; flex: 1 1 auto; min-height: 0; position: relative;
  background: radial-gradient(120% 90% at 50% 30%, #ffffff 40%, #f4ebd8 100%);
  border: 1px solid #e5d5b0; border-radius: 3mm;
  display: flex; align-items: center; justify-content: center; padding: 4mm;
}
.frame-main img { max-width: 88%; max-height: 100%; object-fit: contain; }
.insp {
  margin-top: 4mm; width: 100%;
  border: 1px solid #c9a24b; border-radius: 2.2mm; background: #fffaf0;
  padding: 2.6mm 3mm; text-align: center; display: flex; align-items: center; justify-content: center; gap: 2.4mm;
}
.insp svg { width: 5mm; height: 5mm; color: #b8892f; flex: 0 0 auto; }
.insp-label { font-family: 'Montserrat', sans-serif; font-size: 7pt; letter-spacing: 0.3em; color: #b8892f; }
.insp-name { font-family: 'Noto Serif', serif; font-size: 11.5pt; font-weight: 600; color: #241d13; margin-top: 0.6mm; }
.thumbs { display: flex; gap: 3mm; margin-top: 3.5mm; width: 100%; }
.thumbs .thumb {
  width: 42%; aspect-ratio: 4 / 3.4; border: 1px solid #e5d5b0; border-radius: 2mm;
  background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 1.5mm;
}
.thumbs .thumb img { max-width: 96%; max-height: 96%; object-fit: contain; }
.thumbs .thumb.spacer { visibility: hidden; }

.side { width: 48%; display: flex; flex-direction: column; gap: 3.6mm; min-height: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 1.8mm; }
.badge {
  font-family: 'Montserrat', sans-serif; font-size: 7pt; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; color: #6b5a33; background: #f1e7cd; border: 1px solid #ddc893;
  border-radius: 10mm; padding: 1.4mm 3mm;
}
.badge.strong { color: #fff; background: linear-gradient(135deg,#b8892f,#8a6a22); border-color: #8a6a22; }
.badge.price {
  color: #fff; background: linear-gradient(135deg,#2f7d4f,#1f5c39); border-color: #1f5c39;
  font-size: 8.5pt; padding: 1.8mm 4mm;
}

.desc {
  font-size: 9.3pt; line-height: 1.5; color: #3a3125; margin: 0; text-align: justify; hyphens: auto;
}
.desc .lead { color: #b8892f; font-weight: 700; }

.techgrid {
  background: #fff; border: 1px solid #e5d5b0; border-radius: 2.6mm; padding: 3mm 3mm 2.5mm; flex: 0 0 auto;
}
.py-title { font-family: 'Montserrat', sans-serif; font-size: 7pt; letter-spacing: 0.3em; color: #b8892f; text-align: center; margin-bottom: 2.2mm; }
.tech-row { display: flex; align-items: flex-start; gap: 2.2mm; padding: 1.5mm 0; border-top: 1px dashed #eadcbd; }
.tech-row:first-of-type { border-top: none; }
.tech-icon { width: 6mm; height: 6mm; color: #b8892f; flex: 0 0 auto; margin-top: 0.3mm; }
.tech-icon svg { width: 100%; height: 100%; }
.tech-body { flex: 1 1 auto; }
.tech-k { font-family: 'Montserrat', sans-serif; font-size: 6.4pt; letter-spacing: 0.18em; color: #9c8a5f; text-transform: uppercase; }
.tech-v { font-size: 8.6pt; font-weight: 700; color: #241d13; margin-top: 0.4mm; line-height: 1.3; }

.destaques { display: flex; flex-wrap: wrap; gap: 1.6mm; }
.dchip {
  display: inline-flex; align-items: center;
  font-size: 7.4pt; color: #3a3125; background: #f8f2e4; border: 1px solid #e3d3a9;
  border-radius: 1.6mm; padding: 0.9mm 2.4mm; font-weight: 600;
}

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
.spec.venda { background: #f3f9f4; }
.spec.venda .v { color: #1f5c39; }

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
    return json.load(open(os.path.join(DATA, "smartphone-db.json"), encoding="utf-8"))["smartphones"]


def find_images(brand_key, modelo):
    brand_slug = BRAND_SLUG[brand_key]
    model_slug = slugify(modelo)
    pdir = os.path.join(IMGDIR, brand_slug, model_slug)
    if not os.path.isdir(pdir):
        return []
    files = sorted(os.listdir(pdir))
    return [os.path.join(pdir, fn) for fn in files]


def tech_row(icon_name, label, value):
    if not value:
        return ""
    return ('<div class="tech-row"><div class="tech-icon">%s</div>'
            '<div class="tech-body"><div class="tech-k">%s</div><div class="tech-v">%s</div></div></div>'
            ) % (icon(icon_name), label, value)


def page_html(brand_key, m, idx, total):
    modelo = m["modelo"]
    marca = m.get("marca") or BRAND_DISPLAY[brand_key]
    specs = m.get("specs") or {}
    custo = m.get("custo")  # NUNCA renderizado
    venda = m.get("venda") or "—"
    destaques = m.get("destaques") or []
    kit = m.get("kit_inclui")
    desc_longa = m.get("descricao_longa") or m.get("descricao_curta") or ""
    desc_longa = re.sub(r"^[^\wÀ-ÿ]{1,4}\s*", "", desc_longa)

    tela = specs.get("tela") or "—"
    bateria = specs.get("bateria") or "—"
    camera = specs.get("camera") or "—"
    chip = specs.get("chip") or "—"
    armazenamento = specs.get("armazenamento") or "—"
    ram = specs.get("ram") or "—"

    imgs = find_images(brand_key, modelo)
    if not imgs:
        imgs = ["https://via.placeholder.com/600x700?text=sem+imagem"]
    imgs = [("file://" + quote(os.path.abspath(optimize(i)))) if not i.startswith("http") else i for i in imgs]

    main = imgs[0]
    secs = imgs[1:3]
    thumbs = "".join('<div class="thumb"><img src="%s"></div>' % s for s in secs)

    destaques_html = "".join('<span class="dchip">%s</span>' % d for d in destaques)

    kit_html = ""
    if kit:
        kit_html = (
            '<div class="insp">%s<div><div class="insp-label">KIT INCLUI</div>'
            '<div class="insp-name">%s</div></div></div>' % (icon("kit"), kit)
        )

    pageno = "%02d" % idx

    return f"""
<section class="page">
  <div class="topline"></div>
  <div class="topline-sub"></div>
  <header>
    <div class="watermark">{idx:02d}</div>
    <div class="brand">{marca}</div>
    <div class="brand-sub">SMARTPHONE · GJ STORE</div>
    <h1>{modelo}</h1>
    <div class="meta-line">{armazenamento} · <b>{ram} RAM</b> · {chip}</div>
  </header>

  <div class="stage">
    <div class="hero">
      <div class="frame-main"><img src="{main}"></div>
      {kit_html}
      <div class="thumbs">{thumbs}</div>
    </div>

    <div class="side">
      <div class="chips">
        <span class="badge price">{venda}</span>
        <span class="badge strong">{armazenamento}</span>
        <span class="badge">{ram} RAM</span>
      </div>
      <p class="desc"><span class="lead">{marca}</span> — {desc_longa}</p>

      <div class="techgrid">
        <div class="py-title">FICHA TÉCNICA</div>
        {tech_row("tela", "Tela", tela)}
        {tech_row("bateria", "Bateria", bateria)}
        {tech_row("camera", "Câmera", camera)}
        {tech_row("chip", "Chip", chip)}
      </div>

      <div class="destaques">{destaques_html}</div>
    </div>
  </div>

  <div class="specs">
    <div class="spec"><div class="k">Marca</div><div class="v">{marca}</div></div>
    <div class="spec"><div class="k">Armazenamento</div><div class="v">{armazenamento}</div></div>
    <div class="spec"><div class="k">Memória RAM</div><div class="v">{ram}</div></div>
    <div class="spec"><div class="k">Chip</div><div class="v">{chip}</div></div>
    <div class="spec"><div class="k">Tela</div><div class="v">{tela}</div></div>
    <div class="spec"><div class="k">Bateria</div><div class="v">{bateria}</div></div>
    <div class="spec"><div class="k">Câmera</div><div class="v">{camera}</div></div>
    <div class="spec venda"><div class="k">Preço de venda</div><div class="v">{venda}</div></div>
  </div>

  <footer><span>CATÁLOGO · SMARTPHONES {marca.upper()}</span><span class="pageno">{pageno} / {total:02d}</span></footer>
</section>
"""


def build_brand(brand_key, models):
    pages = []
    n = len(models)
    for i, m in enumerate(models, 1):
        pages.append(page_html(brand_key, m, i, n))
    return (
        "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='utf-8'>"
        "<title>GJ STORE — Catálogo " + BRAND_DISPLAY[brand_key] + "</title>"
        "<style>" + CSS + "</style></head><body>"
        + svg_defs()
        + "".join(pages)
        + "</body></html>"
    )


def main():
    db = load()
    args = sys.argv[1:]
    wanted = [a.upper() for a in args] if args else list(db.keys())
    for brand_key in wanted:
        if brand_key not in db:
            print("Marca desconhecida:", brand_key, "| válidas:", list(db.keys()))
            continue
        models = db[brand_key]
        html = build_brand(brand_key, models)
        out = os.path.join(BASE, "Catalogo_GJ_STORE_%s.html" % BRAND_FILE[brand_key])
        with open(out, "w", encoding="utf-8") as f:
            f.write(html)
        print("HTML gerado:", out, "|", len(re.findall(r'class="page"', html)), "páginas")


if __name__ == "__main__":
    main()
