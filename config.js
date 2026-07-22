// GJ Store — configuração central
// Ao reimplantar o Apps Script, atualize APENAS esta linha:
// Deployment @34 (2026-07-22): perf cache por-categoria + invalidacao automatica.
const GAS_URL = "https://script.google.com/macros/s/AKfycbyhOCMQJkxf-sIyzItAcpUmxF1MTgo47WXVb0qDVSMXc0bcVD468xmIVwlkUNQKZt01/exec";

// URL pública do site — usada nos links de compartilhar produto
const CFG_SITE_URL = "https://gjstore.github.io/GJSTORE/";

// URLs absolutas para navegação cross-repo
// admin.html + gestao_unificada.html (repo GJSTORE-ADM) ↔ index.html (repo GJSTORE)
const CFG_ADMIN_URL  = "https://gjstore.github.io/GJSTORE-ADM/admin.html";
const CFG_GESTAO_URL = "https://gjstore.github.io/GJSTORE-ADM/gestao_unificada.html";

// Cloudinary — conta do GJ Store (admin usa pra subir imagens)
const CFG_CLOUDINARY_CLOUD  = "dxffbx07d";
const CFG_CLOUDINARY_PRESET = "gj_store";
