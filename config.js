// GJ Store — configuração central
// Ao reimplantar o Apps Script, atualize APENAS esta linha:
// Deployment @36 (2026-07-22): script-level cache + CacheService 200 max + frontend timeout
const GAS_URL = "https://script.google.com/macros/s/AKfycbxA0KPHoZReOqEW9GosO6IBjKtxi7vDmrhlVHOc2HUNfir7X8Y0QlvcZwcOYCcsV9sd/exec";

// URL pública do site — usada nos links de compartilhar produto
const CFG_SITE_URL = "https://gjstore.github.io/GJSTORE/";

// URLs absolutas para navegação cross-repo
// admin.html + gestao_unificada.html (repo GJSTORE-ADM) ↔ index.html (repo GJSTORE)
const CFG_ADMIN_URL  = "https://gjstore.github.io/GJSTORE-ADM/admin.html";
const CFG_GESTAO_URL = "https://gjstore.github.io/GJSTORE-ADM/gestao_unificada.html";

// Cloudinary — conta do GJ Store (admin usa pra subir imagens)
const CFG_CLOUDINARY_CLOUD  = "eslbyl14";
const CFG_CLOUDINARY_PRESET = "gjstore2";

// Openinary — self-hosted no Nuvário (substitui Cloudinary pra imagens do catálogo)
const CFG_OPENINARY_URL = "https://servidor-1.tailc513c6.ts.net:3100";
