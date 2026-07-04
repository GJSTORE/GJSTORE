// GJ Store — configuração central
// Ao reimplantar o Apps Script, atualize APENAS esta linha:
// Deployment @20 (2026-07-04): UNIFICADO — loja e admin na MESMA URL (fim do bz0/bz9 divergente).
// Inclui: excluirPedidoHard + Log_Acoes (auditoria) + analyticsHealth.
const GAS_URL = "https://script.google.com/macros/s/AKfycbwUXgshBf4GkQQ4htADlZMCvWe9AOawFjFrxftYqsjZlMfBGmaOi3LfE86ehdX2zNYi/exec";

// URL pública do site — usada nos links de compartilhar produto
const CFG_SITE_URL = "https://gjstore.github.io/GJSTORE/";

// URLs absolutas para navegação cross-repo
// admin.html + gestao_unificada.html (repo GJSTORE-ADM) ↔ index.html (repo GJSTORE)
const CFG_ADMIN_URL  = "https://gjstore.github.io/GJSTORE-ADM/admin.html";
const CFG_GESTAO_URL = "https://gjstore.github.io/GJSTORE-ADM/gestao_unificada.html";

// Cloudinary — conta do GJ Store (admin usa pra subir imagens)
const CFG_CLOUDINARY_CLOUD  = "dxffbx07d";
const CFG_CLOUDINARY_PRESET = "gj_store";
