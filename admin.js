    // Init tema + sessão antes de qualquer render
    (function() {
      let t = localStorage.getItem("gj_theme") || "cyberpunk";
      if (t === "botafogo") { t = "gold"; localStorage.setItem("gj_theme", t); }
      if (t !== "cyberpunk") document.documentElement.className = "theme-" + t;

      // Auto-bypass login se sessão válida (< 7 dias)
      const sess = localStorage.getItem("gj_session");
      if (sess) {
        try {
          const { token, ts } = JSON.parse(sess);
          if (token && (Date.now() - ts) < 7 * 24 * 60 * 60 * 1000) {
            document.addEventListener("DOMContentLoaded", function() {
              TOKEN = token;
              document.getElementById("loginScreen").style.display = "none";
              document.getElementById("app").style.display = "block";
              initApp();
            });
          }
        } catch(e) { localStorage.removeItem("gj_session"); }
      }
    })();

    const API = (typeof GAS_URL !== "undefined") ? GAS_URL : "https://script.google.com/macros/s/AKfycbzeMVsJTFdvOKKjwbPDxM2pb26-xYd_nlpjSzFQ0hAkvWSj3VinnELnYm8hNcdV1CZp/exec";
    const CLOUDINARY_CLOUD = "dxffbx07d";
    const CLOUDINARY_PRESET = "gj_store";
    const WPP = "5521970363062";

    let TOKEN = "";
    let allProds = [], allPeds = [];
    let mediaUrls = [];
    let dragId = null;
    let touchPedId = null, touchStartY = 0, touchCol = null;
    let pedOffset = 0;
    const PED_PAGE = 30;
    let kanbanFilter = "";
    let currentDetailPed = null;
    let baixaStatusSel = "Antecipado";
    let dashChart = null;
    let mktSize = "1:1";
    let mktProdData = null;
    let mktCfg = { blur: 0, overlay: 40, font: 22, textY: 72 };

    function mktSliderChange() {
      mktCfg.blur = Number(document.getElementById("mktBlur").value);
      mktCfg.overlay = Number(document.getElementById("mktOverlay").value);
      mktCfg.font = Number(document.getElementById("mktFontSz").value);
      mktCfg.textY = Number(document.getElementById("mktTextY").value);
      document.getElementById("mktBlurV").textContent = mktCfg.blur + "px";
      document.getElementById("mktOverlayV").textContent = mktCfg.overlay + "%";
      document.getElementById("mktFontSzV").textContent = mktCfg.font + "px";
      document.getElementById("mktTextYV").textContent = mktCfg.textY + "%";
      mktRender();
    }
    let lastKnownPendingIds = null;
    let notifInterval = null;
    let kanbanDateFilter = "todos";
    let _finFilter = "todos", _finFilterVal = null;
    let _onlineCheckInterval = null;
    const TAXA_PADRAO = 0.33;

    async function apiGet(action, params = {}) {
      const url = new URL(API);
      url.searchParams.set("action", action);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      });
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }

    function fmt(v) { return "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); }
    function fmtDate(s) { try { return String(s).split(" ")[0]; } catch (e) { return s; } }

    function toast(msg, type = "ok") {
      const el = document.createElement("div");
      el.className = "toast " + type;
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2800);
    }

    function toastConfirm(msg, btnA, btnB, onA, onB) {
      document.querySelectorAll(".toast-confirm").forEach(e => e.remove());
      const el = document.createElement("div");
      el.className = "toast-confirm";
      el.innerHTML = `<div style="font-size:13px;font-weight:600;margin-bottom:10px;line-height:1.45">${msg}</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button style="flex:1;min-width:110px;padding:8px 10px;border-radius:9px;border:1px solid var(--g);background:rgba(0,230,118,.12);color:var(--g);font-weight:700;font-size:12px;cursor:pointer" id="tc-a">${btnA}</button><button style="flex:1;min-width:110px;padding:8px 10px;border-radius:9px;border:1px solid rgba(255,109,0,.4);background:rgba(255,109,0,.1);color:var(--o);font-weight:700;font-size:12px;cursor:pointer" id="tc-b">${btnB}</button></div>`;
      document.body.appendChild(el);
      el.querySelector("#tc-a").onclick = () => { el.remove(); onA(); };
      el.querySelector("#tc-b").onclick = () => { el.remove(); onB(); };
      setTimeout(() => { if (document.body.contains(el)) el.remove(); }, 12000);
    }

    function toastUndo(msg, onConfirm, onUndo = null, ms = 5000) {
      document.querySelectorAll(".toast-undo").forEach(e => e.remove());
      const el = document.createElement("div");
      el.className = "toast ok toast-undo";
      el.innerHTML = `<span>${msg}</span><button class="undo-btn">↩ Desfazer</button>`;
      document.body.appendChild(el);
      let done = false;
      el.querySelector(".undo-btn").onclick = () => {
        if (!done) { done = true; el.remove(); if (onUndo) onUndo(); }
      };
      setTimeout(() => {
        if (!done && document.body.contains(el)) { done = true; el.remove(); onConfirm(); }
      }, ms);
    }

    // ACCORDION
    function toggleAcc(id) {
      const body = document.getElementById(id);
      const chev = document.getElementById("chev-" + id);
      const isOpen = body.style.maxHeight !== "0px" && body.style.maxHeight !== "";
      if (isOpen) {
        body.style.maxHeight = "0px";
        if (chev) chev.classList.remove("open");
      } else {
        body.style.maxHeight = "2000px";
        if (chev) chev.classList.add("open");
      }
      try { localStorage.setItem("acc-" + id, isOpen ? "0" : "1"); } catch (e) { }
    }
    function restoreAcc(id, defaultOpen = true) {
      const body = document.getElementById(id);
      const chev = document.getElementById("chev-" + id);
      const saved = localStorage.getItem("acc-" + id);
      const open = saved === null ? defaultOpen : saved === "1";
      body.style.maxHeight = open ? "2000px" : "0px";
      if (chev) { if (open) chev.classList.add("open"); else chev.classList.remove("open"); }
    }

    // LOGIN
    async function login() {
      const senha = document.getElementById("senhaIn").value.trim();
      if (!senha) return;
      const btn = document.getElementById("loginBtn");
      btn.disabled = true; btn.textContent = "Verificando...";
      document.getElementById("loginErr").style.display = "none";
      try {
        const res = await apiGet("adminLogin", { senha });
        if (res.ok) {
          TOKEN = res.token;
          localStorage.setItem("gj_session", JSON.stringify({ token: TOKEN, ts: Date.now() }));
          document.getElementById("loginScreen").style.display = "none";
          document.getElementById("app").style.display = "block";
          apiGet("logAcao", { sessao: "admin", acao: "LOGIN_ADMIN", origem: "adm", dispositivo: /Mobi/i.test(navigator.userAgent) ? "Mobile" : "Desktop" }).catch(() => {});
          initApp();
        } else {
          document.getElementById("loginErr").style.display = "block";
          document.getElementById("loginErr").textContent = res.error || "Senha incorreta.";
        }
      } catch (e) {
        document.getElementById("loginErr").style.display = "block";
        document.getElementById("loginErr").textContent = "Erro de conexão.";
      }
      btn.disabled = false; btn.textContent = "Entrar no Painel";
    }

    function initApp() {
      loadAndApplyConfig();
      loadHome();
      loadCategorias();
      loadTemas();
      restoreAcc("acc-recentes", true);
      restoreAcc("acc-lowstock", true);
      restoreAcc("acc-crm", true);
      if ("Notification" in window) Notification.requestPermission().catch(() => { });
      startNotifPolling();
    }

    function logout() {
      TOKEN = "";
      localStorage.removeItem("gj_session");
      if (notifInterval) clearInterval(notifInterval);
      document.getElementById("loginScreen").style.display = "flex";
      document.getElementById("app").style.display = "none";
      document.getElementById("senhaIn").value = "";
    }

    // NAVIGATION
    const MAIS_PAGES = ["doc", "mkt", "cat", "clientes", "analytics", "cupons"];
    function goPage(id, btn) {
      document.querySelectorAll(".page").forEach(p => p.classList.remove("on"));
      document.querySelectorAll(".bni").forEach(b => b.classList.remove("on"));
      document.getElementById("page-" + id).classList.add("on");
      if (MAIS_PAGES.includes(id)) {
        document.getElementById("nav-mais").classList.add("on");
      } else {
        btn.classList.add("on");
      }
      if (id === "home") loadHome();
      if (id === "prod") loadProds();
      if (id === "ped") loadPeds();
      if (id === "fin") loadFin();
      if (id === "mkt") initMkt();
      if (id === "doc") { initDoc(); renderContactChips(); }
      if (id === "cat") loadCategorias();
      if (id === "analytics") loadAnalytics();
      if (id === "cupons") loadCupons();
      if (id === "op") loadOperadores();
      if (id === "clientes") loadClientesPage();
    }

    function openMaisSheet() {
      document.getElementById("maisOverlay").style.display = "block";
      document.getElementById("maisSheet").classList.add("open");
    }
    function closeMaisSheet() {
      document.getElementById("maisOverlay").style.display = "none";
      document.getElementById("maisSheet").classList.remove("open");
    }

    // HOME
    async function loadHome() {
      renderGreeting();
      updateOnlineStatus();
      try {
        const [pr, pp, cf, kpis] = await Promise.all([
          apiGet("getProdutos"),
          apiGet("getPedidos"),
          apiGet("getPrevisaoCaixa"),
          apiGet("getKPIs").catch(() => null)
        ]);
        const prods = (pr && Array.isArray(pr.produtos)) ? pr.produtos : [];
        const peds  = (pp && Array.isArray(pp.pedidos))  ? pp.pedidos  : [];
        allProds = prods; allPeds = peds;

        const hoje = new Date().toLocaleDateString("pt-BR");
        const hojeP = peds.filter(p => String(p["Data/Hora"] || "").startsWith(hoje));
        const fat = hojeP.reduce((s, p) => s + Number(p["Total (R$)"] || 0), 0);
        const pend = peds.filter(p => p["Status"] === "Pendente");
        const low = prods.filter(p => p["Estoque"] !== null && p["Estoque"] !== undefined && Number(p["Estoque"]) <= 3);

        document.getElementById("s1").textContent = hojeP.length;
        document.getElementById("s2").textContent = fat > 0 ? fmt(fat) : "R$ 0";
        document.getElementById("s3").textContent = pend.length;
        document.getElementById("s4").textContent = low.length;

        // KPIs extras
        if (kpis && !kpis.error) {
          const s5 = document.getElementById("s5"); if (s5) s5.textContent = kpis.ticketMedio ? fmt(kpis.ticketMedio) : "—";
          const s6 = document.getElementById("s6"); if (s6) s6.textContent = kpis.taxaConversao != null ? kpis.taxaConversao.toFixed(1) + "%" : "—";
          const s7 = document.getElementById("s7"); if (s7) s7.textContent = kpis.pedidosMes ?? "—";
          const s8 = document.getElementById("s8"); if (s8) s8.textContent = kpis.pedidosFinalizados ?? "—";
          // Meta bar
          const pct = Math.min(100, Number(kpis.progresso || 0));
          const fill = document.getElementById("metaBarFill"); if (fill) fill.style.width = pct + "%";
          const pctEl = document.getElementById("metaProgPct"); if (pctEl) pctEl.textContent = pct.toFixed(0) + "%";
          const tgt = document.getElementById("metaTarget"); if (tgt) tgt.textContent = "Meta: " + fmt(kpis.meta || 0);
          const valTxt = document.getElementById("metaValTxt"); if (valTxt) valTxt.textContent = fmt(kpis.fatMes || 0) + " / " + fmt(kpis.meta || 0);
          const wrap = document.getElementById("metaBarWrap"); if (wrap) wrap.style.display = "block";
        }

        if (cf) {
          const p7 = cf.previsao7 || {}; const p30 = cf.previsao30 || {};
          document.getElementById("cf7").textContent = fmt(p7.total || 0);
          document.getElementById("cf7c").textContent = (p7.count || 0) + " pedidos";
          document.getElementById("cf30").textContent = fmt(p30.total || 0);
          document.getElementById("cf30c").textContent = (p30.count || 0) + " pedidos";
        }

        buildHomeAlertas(prods, peds);
        buildTopProds(peds);

        const rec = document.getElementById("drecentes");
        rec.innerHTML = peds.slice(0, 6).map(p => {
          return `<div class="rcard" data-ped-id="${p["ID Pedido"] || ""}" style="cursor:pointer">
        <div class="rc-l">
          <div class="rc-nm">${p["Nome Cliente"] || "—"}</div>
          <div class="rc-dt">${p["Data/Hora"] || ""}</div>
        </div>
        <div class="rc-val">${fmt(p["Total (R$)"])}</div>
        <div class="badge ${bc(p["Status"])}">${p["Status"] || ""}</div>
      </div>`;
        }).join("") || `<div class="empty">Nenhum pedido ainda</div>`;

        const ls = document.getElementById("dlowstock");
        ls.innerHTML = low.map(p => `
      <div class="ls-row">
        <div class="ls-nm">${p["Nome do Produto"] || "—"}</div>
        <div class="ls-qty">${p["Estoque"]} un.</div>
      </div>`).join("") || `<div class="empty" style="color:var(--g)">✅ Estoque OK</div>`;

        loadCRM();
        loadAband();
        buildOperadoresPanel(peds);
      } catch (e) {
        document.getElementById("drecentes").innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar.</div>`;
      }
    }

    function renderGreeting() {
      const el = document.getElementById("homeGreeting");
      if (!el) return;
      const h = new Date().getHours();
      const ico = h < 12 ? "☀️" : h < 18 ? "🌤️" : "🌙";
      const saud = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
      const now = new Date().toLocaleString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
      el.innerHTML = `<div class="home-greeting-box">
        <div class="home-greeting-ico">${ico}</div>
        <div>
          <div class="home-greeting-txt">${saud}, Guilherme!</div>
          <div class="home-greeting-sub">${now.charAt(0).toUpperCase() + now.slice(1)} · GJ Store Admin</div>
        </div>
      </div>`;
    }

    function buildHomeAlertas(prods, peds) {
      const el = document.getElementById("homeAlertas");
      if (!el) return;
      const alerts = [];
      const low = prods.filter(p => p["Estoque"] !== null && p["Estoque"] !== undefined && Number(p["Estoque"]) <= 3 && p["Status"] !== "Inativo");
      if (low.length) alerts.push({ c: "r", ico: "🔴", msg: `${low.length} produto(s) com estoque crítico (≤ 3)`, sub: low.slice(0, 3).map(p => p["Nome do Produto"]).join(", ") + (low.length > 3 ? "..." : "") });
      const now = Date.now();
      const oldPend = peds.filter(p => {
        if (p["Status"] !== "Pendente") return false;
        const dt = String(p["Data/Hora"] || "").split("/");
        if (dt.length < 3) return false;
        const [d, m, rest] = dt; const [y, time = "0:0"] = rest.split(" ");
        const [hh, mm] = time.split(":");
        return (now - new Date(y, m - 1, d, hh, mm).getTime()) > 172800000;
      });
      if (oldPend.length) alerts.push({ c: "o", ico: "⏰", msg: `${oldPend.length} pedido(s) Pendente há mais de 48h`, sub: oldPend.slice(0, 3).map(p => p["Nome Cliente"]).join(", ") });
      const next7 = new Date(); next7.setDate(next7.getDate() + 7);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const venc = peds.filter(p => {
        if (["Finalizado", "Cancelado"].includes(p["Status"])) return false;
        const dv = String(p["Data_Vencimento"] || "").split("/");
        if (dv.length < 3) return false;
        const d = new Date(dv[2], dv[1] - 1, dv[0]);
        return d >= today && d <= next7;
      });
      if (venc.length) alerts.push({ c: "c", ico: "📅", msg: `${venc.length} vencimento(s) nos próximos 7 dias`, sub: venc.slice(0, 3).map(p => p["Nome Cliente"]).join(", ") });
      if (!alerts.length) {
        el.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:10px 14px;background:rgba(0,230,118,.08);border-left:3px solid var(--g);border-radius:0 10px 10px 0;margin-bottom:12px;color:var(--g);font-size:13px;font-weight:600">✅ Tudo certo! Nenhum alerta no momento.</div>`;
        return;
      }
      el.innerHTML = `<div style="margin-bottom:10px">${alerts.map(a => `<div style="padding:10px 14px;background:rgba(${a.c==="r"?"244,67,54":a.c==="o"?"255,109,0":"0,188,212"},.1);border-left:3px solid var(--${a.c});border-radius:0 10px 10px 0;margin-bottom:6px"><div style="font-size:13px;font-weight:700">${a.ico} ${a.msg}</div>${a.sub?`<div style="font-size:11px;color:var(--muted);margin-top:2px">${a.sub}</div>`:""}</div>`).join("")}</div>`;
    }

    function buildTopProds(peds) {
      const el = document.getElementById("homeTopProd");
      if (!el) return;
      const map = {};
      peds.filter(p => p["Status"] !== "Cancelado").forEach(ped => {
        String(ped["Itens"] || "").split("|").forEach(item => {
          const name = item.trim().replace(/\s*[xX]\s*\d+\s*$/, "").trim();
          if (name) map[name] = (map[name] || 0) + 1;
        });
      });
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
      if (!sorted.length) { el.innerHTML = `<div class="empty">Sem dados de vendas ainda.</div>`; return; }
      const max = sorted[0][1];
      const medals = ["🥇", "🥈", "🥉"];
      el.innerHTML = sorted.map(([nome, total], i) => `
        <div class="top-prod-row">
          <div style="width:22px;text-align:center;font-size:15px;flex-shrink:0">${medals[i] || i + 1}</div>
          <div class="top-prod-bar-wrap">
            <div class="top-prod-nm">${nome.substring(0, 38)}</div>
            <div class="top-prod-bar"><div class="top-prod-fill" style="width:${(total / max * 100).toFixed(1)}%"></div></div>
          </div>
          <span class="top-prod-count">${total}×</span>
        </div>`).join("");
    }

    async function loadCRM() {
      try {
        const r = await apiGet("getCRM");
        const clientes = r.clientes || [];
        const el = document.getElementById("dcrm");
        if (!clientes.length) { el.innerHTML = `<div class="empty" style="color:var(--g)">✅ Todos os clientes ativos!</div>`; return; }
        el.innerHTML = clientes.map(c => {
          const last4 = String(c.tel || "").slice(-4);
          const cupom = "VOLTEI" + last4;
          const msg = encodeURIComponent(`Oi ${c.nome}! Saudades de você na GJ Store! 👋 Use o cupom *${cupom}* para ganhar desconto especial na sua próxima compra!`);
          const wppUrl = `https://wa.me/55${c.tel}?text=${msg}`;
          return `<div class="crm-row">
        <div class="crm-info">
          <div class="crm-nm">${c.nome || "—"}</div>
          <div class="crm-sub">📱 ${c.tel} · Última compra: ${c.ultima}</div>
        </div>
        <div class="crm-days">${c.diasSemComprar}d</div>
        <button class="crm-cupom-btn" data-tel="${c.tel}" data-nome="${(c.nome||"").replace(/"/g,"")}" title="Criar cupom ${cupom} e enviar pelo WhatsApp">🎟️ Cupom</button>
        <button class="crm-wpp" data-wpp-url="${encodeURIComponent(wppUrl)}">💬 Reengajar</button>
      </div>`;
        }).join("");
      } catch (e) {
        document.getElementById("dcrm").innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar CRM</div>`;
      }
    }

    async function crmCriarCupom(tel, nome) {
      try {
        const last4 = String(tel).slice(-4);
        const cupomCod = "VOLTEI" + last4;
        toast("⏳ Criando cupom " + cupomCod + "...");
        const res = await apiGet("criarCupomReengajamento", { telefone: tel });
        if (!res || res.error) { toast(res?.error || "Erro ao criar cupom", "err"); return; }
        const msg = encodeURIComponent(`Oi ${nome}! Criamos um cupom exclusivo pra você 🎁\n\n*${res.codigo || cupomCod}* — ${res.desconto || "10"}% OFF na sua próxima compra!\n\nVálido por 30 dias. Aproveite! 🛒`);
        window.open(`https://wa.me/55${tel}?text=${msg}`, "_blank");
        toast("✅ Cupom criado e WhatsApp aberto!");
      } catch (e) {
        toast("Erro ao criar cupom", "err");
      }
    }

    function bc(s) {
      return { "Pendente": "b-p", "Em andamento": "b-a", "Finalizado": "b-f", "Cancelado": "b-c" }[s] || "b-p";
    }

    // CHART
    function buildChart(peds) {
      const wrap = document.getElementById("chartWrap");
      wrap.style.display = "block";
      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ label: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), month: d.getMonth(), year: d.getFullYear() });
      }
      const fat = months.map(m => peds.filter(p => {
        const dt = String(p["Data/Hora"] || "").split("/");
        return dt.length >= 3 && Number(dt[1]) - 1 === m.month && Number(dt[2].slice(0, 4)) === m.year;
      }).reduce((s, p) => s + Number(p["Total (R$)"] || 0), 0));

      const custo = months.map(m => peds.filter(p => {
        const dt = String(p["Data/Hora"] || "").split("/");
        return dt.length >= 3 && Number(dt[1]) - 1 === m.month && Number(dt[2].slice(0, 4)) === m.year;
      }).reduce((s, p) => s + Number(p["Custo_Lote"] || 0), 0));

      const lucro = fat.map((f, i) => f - custo[i]);

      const ctx = document.getElementById("dashChart").getContext("2d");
      if (dashChart) dashChart.destroy();
      dashChart = new Chart(ctx, {
        type: "line",
        data: {
          labels: months.map(m => m.label),
          datasets: [
            { label: "Faturamento", data: fat, borderColor: "#00e676", backgroundColor: "rgba(0,230,118,.08)", tension: 0.4, pointRadius: 4, pointBackgroundColor: "#00e676", hidden: false },
            { label: "Lucro", data: lucro, borderColor: "#00bcd4", backgroundColor: "rgba(0,188,212,.08)", tension: 0.4, pointRadius: 4, pointBackgroundColor: "#00bcd4", hidden: false },
            { label: "Custo", data: custo, borderColor: "#f44336", backgroundColor: "rgba(244,67,54,.06)", tension: 0.4, pointRadius: 4, pointBackgroundColor: "#f44336", hidden: true }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "rgba(226,244,255,.05)" }, ticks: { color: "rgba(226,244,255,.4)", font: { size: 11 } } },
            y: { grid: { color: "rgba(226,244,255,.05)" }, ticks: { color: "rgba(226,244,255,.4)", font: { size: 11 }, callback: v => "R$" + (v >= 1000 ? (v / 1000).toFixed(1) + "k" : v) } }
          }
        }
      });
      // Restore button states
      ["cht-fat", "cht-luc", "cht-cus"].forEach((id, i) => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.toggle("off", dashChart.data.datasets[i].hidden);
      });

      // Payment methods donut
      buildPayChart(peds);
    }

    let payChart = null;
    function buildPayChart(peds) {
      const wrap = document.getElementById("payChartWrap");
      const counts = {};
      peds.forEach(p => {
        const pm = p["Forma Pagamento"] || "Outros";
        counts[pm] = (counts[pm] || 0) + 1;
      });
      const labels = Object.keys(counts);
      if (!labels.length) return;
      wrap.style.display = "block";
      const colors = ["#00e676","#00bcd4","#ff6d00","#7c4dff","#f44336","#26a69a","#ffca28","#ef5350"];
      const ctx2 = document.getElementById("payChart").getContext("2d");
      if (payChart) payChart.destroy();
      payChart = new Chart(ctx2, {
        type: "doughnut",
        data: {
          labels,
          datasets: [{ data: labels.map(l => counts[l]), backgroundColor: colors.slice(0, labels.length), borderWidth: 0 }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "right", labels: { color: "rgba(226,244,255,.6)", font: { size: 11 }, boxWidth: 12 } }
          }
        }
      });
    }

    function buildOperadoresPanel(peds, targetId) {
      const el = document.getElementById(targetId || "doperadores");
      if (!el) return;
      const mapa = {};
      peds.forEach(p => {
        const resp = (p["Responsavel"] || "").trim() || "— Sem operador";
        if (!mapa[resp]) mapa[resp] = { nome: resp, total: 0, finalizado: 0, cancelado: 0, faturamento: 0 };
        mapa[resp].total++;
        if (p["Status"] === "Finalizado") { mapa[resp].finalizado++; mapa[resp].faturamento += Number(p["Total (R$)"] || 0); }
        if (p["Status"] === "Cancelado") mapa[resp].cancelado++;
      });
      const lista = Object.values(mapa).sort((a, b) => b.faturamento - a.faturamento);
      if (!lista.length || (lista.length === 1 && lista[0].nome === "— Sem operador")) {
        el.innerHTML = `<div class="empty" style="color:var(--muted)">Nenhum pedido com operador registrado. Atribua um responsável ao criar pedidos manualmente.</div>`;
        return;
      }
      el.innerHTML = lista.map(op => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px;background:var(--d2);border-radius:10px;margin-bottom:6px">
          <div>
            <div style="font-weight:700;font-size:14px">${op.nome}</div>
            <div style="font-size:11px;color:var(--muted)">${op.total} pedidos · ✅${op.finalizado} · ✕${op.cancelado}</div>
          </div>
          <div style="font-family:var(--H);font-weight:800;font-size:15px;color:var(--g)">${fmt(op.faturamento)}</div>
        </div>`).join("");
    }

    function toggleDataset(idx) {
      if (!dashChart) return;
      const ds = dashChart.data.datasets[idx];
      ds.hidden = !ds.hidden;
      dashChart.update();
      const ids = ["cht-fat", "cht-luc", "cht-cus"];
      const btn = document.getElementById(ids[idx]);
      if (btn) btn.classList.toggle("off", ds.hidden);
    }

    // PRODUTOS
    async function loadProds() {
      if (!allProds.length) {
        const r = await apiGet("getProdutos").catch(() => ({ produtos: [] }));
        allProds = r.produtos || [];
      }
      renderProds();
    }

    function renderProds() {
      const q = (document.getElementById("psearch").value || "").toLowerCase();
      const cat = document.getElementById("pcat").value;
      const stat = document.getElementById("pstatus").value;
      const inativos = allProds.filter(p => p["Status"] === "Inativo").length;
      const cntEl = document.getElementById("inativeCnt");
      if (cntEl) {
        if (inativos > 0) { cntEl.textContent = inativos + " inativos"; cntEl.style.display = "inline-block"; }
        else { cntEl.style.display = "none"; }
      }
      const list = allProds.filter(p => {
        const mq = !q || (p["Nome do Produto"] || "").toLowerCase().includes(q);
        const mcat = !cat || p["Categoria"] === cat;
        const mst = !stat || p["Status"] === stat;
        return mq && mcat && mst;
      });
      const el = document.getElementById("plist");
      if (!list.length) { el.innerHTML = `<div class="empty">Nenhum produto encontrado</div>`; return; }
      el.innerHTML = list.map(p => {
        const img = p["Imagem 1 (URL)"] || "";
        const forn = p["Fornecedores_JSON"] ? (() => { try { return JSON.parse(p["Fornecedores_JSON"]).length + " forn."; } catch (e) { return ""; } })() : "";
        const gar = p["Garantia_Padrao"] ? p["Garantia_Padrao"].toString().substring(0, 20) : "";
        return `<div class="prow">
      <div class="pthumb">${img ? `<img src="${img}" onerror="this.style.display='none'">` : "📦"}</div>
      <div class="pinfo">
        <div class="pnm">${p["Nome do Produto"] || "—"}</div>
        <div class="pmeta">${p["Categoria"] || ""} · Est: ${p["Estoque"] || 0} · <span style="color:${p["Status"] === "Ativo" ? "var(--g)" : "var(--r)"}">${p["Status"] || ""}</span>${forn ? " · " + forn : ""}${gar ? " · " + gar : ""}</div>
      </div>
      <div class="pprice">${fmt(p["Preço (R$)"])}</div>
      <div class="pacts">
        <button class="actbtn ae" data-prod-id="${p["ID"]}">✏️</button>
        <button class="actbtn ad" data-del-id="${p["ID"]}">🗑️</button>
      </div>
    </div>`;
      }).join("");
    }

    // MODAL PRODUTO
    function openModal() {
      mediaUrls = [];
      document.getElementById("fid").value = "";
      document.getElementById("mtitle").textContent = "Novo Produto";
      ["fnome", "fdesc", "fvar", "fpag", "fpreco", "fpromo", "festoque", "fparcelas", "fforn", "fgarantia", "ftags"].forEach(id => document.getElementById(id).value = "");
      document.getElementById("fcat").value = "";
      document.getElementById("fstatus").value = "Ativo";
      document.getElementById("fdest").value = "Não";
      document.getElementById("previews").innerHTML = "";
      document.getElementById("urlin").value = "";
      document.getElementById("moverlay").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function editProd(prodOrJson) {
      const p = (typeof prodOrJson === "string") ? JSON.parse(prodOrJson) : prodOrJson;
      mediaUrls = [];
      document.getElementById("fid").value = p["ID"] || "";
      document.getElementById("mtitle").textContent = "Editar Produto";
      document.getElementById("fnome").value = p["Nome do Produto"] || "";
      document.getElementById("fcat").value = p["Categoria"] || "";
      document.getElementById("fstatus").value = p["Status"] || "Ativo";
      document.getElementById("fpreco").value = p["Preço (R$)"] || "";
      document.getElementById("fpromo").value = p["Preço Promo (R$)"] || "";
      document.getElementById("festoque").value = p["Estoque"] || "";
      document.getElementById("fparcelas").value = p["Parcelas Máx"] || "";
      document.getElementById("fvar").value = p["Variações (cor|tam|modelo)"] || "";
      document.getElementById("fpag").value = p["Forma Pagamento"] || "";
      document.getElementById("fdesc").value = p["Descrição"] || "";
      document.getElementById("fdest").value = p["Destaque?"] || "Não";
      document.getElementById("fforn").value = p["Fornecedores_JSON"] || "";
      document.getElementById("fgarantia").value = p["Garantia_Padrao"] || "";
      document.getElementById("ftags").value = p["Tags_Personalizadas"] || "";
      const prevEl = document.getElementById("previews");
      prevEl.innerHTML = "";
      [p["Imagem 1 (URL)"], p["Imagem 2 (URL)"], p["Imagem 3 (URL)"], p["Vídeo (URL)"]].forEach(u => { if (u) addPreview(u); });
      document.getElementById("moverlay").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function closeMF(e) { if (e.target === document.getElementById("moverlay")) closeM(); }
    function closeM() { document.getElementById("moverlay").classList.add("hidden"); document.body.style.overflow = ""; }

    async function uploadCloud(file) {
      if (!CLOUDINARY_CLOUD || !CLOUDINARY_PRESET) {
        return new Promise(res => { const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file); });
      }
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", CLOUDINARY_PRESET);
      const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: "POST", body: fd });
      const data = await r.json();
      return data.secure_url;
    }

    async function handleFiles(files) {
      const btn = document.getElementById("savebtn");
      btn.disabled = true; btn.textContent = "⏳ Enviando imagens...";
      for (const f of files) {
        try { const url = await uploadCloud(f); addPreview(url); }
        catch (e) { toast("Erro ao enviar: " + f.name, "err"); }
      }
      btn.disabled = false; btn.textContent = "💾 Salvar Produto";
    }

    function addPreview(url) {
      if (mediaUrls.includes(url)) return;
      mediaUrls.push(url);
      const isV = url.match(/\.(mp4|webm|mov)/i) || url.includes("video");
      const wrap = document.createElement("div"); wrap.className = "previtem";
      wrap.innerHTML = isV ? `<video src="${url}" muted></video>` : `<img src="${url}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2268%22 height=%2268%22><rect width=%2268%22 height=%2268%22 fill=%22%230b1728%22/><text x=%2234%22 y=%2242%22 text-anchor=%22middle%22 fill=%22%2300e676%22 font-size=%2226%22>📦</text></svg>'">`;
      const rm = document.createElement("button"); rm.className = "prevrem"; rm.textContent = "✕";
      rm.onclick = () => { mediaUrls = mediaUrls.filter(u => u !== url); wrap.remove(); };
      wrap.appendChild(rm);
      document.getElementById("previews").appendChild(wrap);
    }

    function addUrl() {
      const url = document.getElementById("urlin").value.trim();
      if (!url) return;
      addPreview(url);
      document.getElementById("urlin").value = "";
    }

    function upDrag(e) { e.preventDefault(); document.getElementById("uparea").classList.add("drag"); }
    function upLeave() { document.getElementById("uparea").classList.remove("drag"); }
    function upDrop(e) { e.preventDefault(); upLeave(); handleFiles(e.dataTransfer.files); }

    async function salvarProd() {
      const nome = document.getElementById("fnome").value.trim();
      const cat = document.getElementById("fcat").value;
      const preco = document.getElementById("fpreco").value;
      if (!nome || !cat || !preco) { toast("Preencha Nome, Categoria e Preço", "err"); return; }
      const btn = document.getElementById("savebtn");
      btn.disabled = true; btn.textContent = "⏳ Salvando...";
      const params = {
        "ID": document.getElementById("fid").value || "",
        "id": document.getElementById("fid").value || "",
        "Nome do Produto": nome,
        "Categoria": cat,
        "Status": document.getElementById("fstatus").value,
        "Preço (R$)": preco,
        "Preço Promo (R$)": document.getElementById("fpromo").value,
        "Estoque": document.getElementById("festoque").value,
        "Parcelas Máx": document.getElementById("fparcelas").value,
        "Variações (cor|tam|modelo)": document.getElementById("fvar").value,
        "Forma Pagamento": document.getElementById("fpag").value,
        "Descrição": document.getElementById("fdesc").value,
        "Destaque?": document.getElementById("fdest").value,
        "Fornecedores_JSON": document.getElementById("fforn").value,
        "Garantia_Padrao": document.getElementById("fgarantia").value,
        "Tags_Personalizadas": document.getElementById("ftags").value,
        "Imagem 1 (URL)": mediaUrls[0] || "",
        "Imagem 2 (URL)": mediaUrls[1] || "",
        "Imagem 3 (URL)": mediaUrls[2] || "",
        "Vídeo (URL)": mediaUrls[3] || "",
      };
      try {
        const res = await apiGet("salvarProduto", params);
        if (res.ok) {
          apiGet("logAcao", { sessao: "admin", acao: params["ID"] ? "EDIT_PRODUCT" : "NEW_PRODUCT", detalhe: res.id || params["ID"] || nome, origem: "adm", dispositivo: "Admin" }).catch(() => {});
          toast("Produto salvo! ✅"); closeM(); allProds = []; await loadProds();
        } else toast(res.error || "Erro ao salvar", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
      btn.disabled = false; btn.textContent = "💾 Salvar Produto";
    }

    function delProd(id, nome) {
      toastUndo(`Inativar "${nome}"?`,
        async () => {
          try {
            const res = await apiGet("deletarProduto", { id });
            if (res.ok) {
              apiGet("logAcao", { sessao: "admin", acao: "DELETE_PRODUCT", detalhe: id, origem: "adm", dispositivo: "Admin" }).catch(() => {});
              toast("Produto inativado"); allProds = []; await loadProds();
            } else toast(res.error || "Erro", "err");
          } catch (e) { toast("Erro de conexão", "err"); }
        }
      );
    }

    // KANBAN
    async function loadPeds() {
      pedOffset = 0;
      const r = await apiGet("getPedidos").catch(() => ({ pedidos: [] }));
      allPeds = r.pedidos || [];
      renderKanban();
      _populateOpList();
    }

    function _populateOpList() {
      const dl = document.getElementById("opNamesList");
      if (!dl) return;
      const nomes = [...new Set(allPeds.map(p => p["Responsavel"] || "").filter(Boolean))];
      dl.innerHTML = nomes.map(n => `<option value="${n}">`).join("");
    }

    function onKanbanSearch(v) {
      kanbanFilter = v;
      pedOffset = 0;
      renderKanban();
    }

    function setKanbanFilter(type, btn) {
      kanbanDateFilter = type;
      document.querySelectorAll(".kfilter-btn").forEach(b => b.classList.remove("on"));
      if (btn) btn.classList.add("on");
      pedOffset = 0;
      renderKanban();
    }

    function _parsePedDate(p) {
      const dt = String(p["Data/Hora"] || "").split("/");
      if (dt.length < 3) return null;
      const [d, m, rest] = dt; const [y] = rest.split(" ");
      return new Date(y, m - 1, d);
    }

    function getFilteredPeds() {
      let peds = allPeds;
      // Text search
      if (kanbanFilter) {
        const re = new RegExp(kanbanFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), "i");
        peds = peds.filter(p =>
          re.test(p["ID Pedido"] || "") ||
          re.test(p["Nome Cliente"] || "") ||
          re.test(p["Itens"] || "")
        );
      }
      // Date filter
      if (kanbanDateFilter && kanbanDateFilter !== "todos") {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const hoje = now;
        const semana = new Date(now); semana.setDate(semana.getDate() - 7);
        peds = peds.filter(p => {
          const dt = _parsePedDate(p);
          if (kanbanDateFilter === "hoje") return dt && dt >= hoje;
          if (kanbanDateFilter === "semana") return dt && dt >= semana;
          if (kanbanDateFilter === "ativos") return ["Pendente", "Em andamento"].includes(p["Status"]);
          if (kanbanDateFilter === "atrasados") {
            if (["Finalizado", "Cancelado"].includes(p["Status"])) return false;
            const dv = String(p["Data_Vencimento"] || "").split("/");
            if (dv.length < 3) return false;
            const d = new Date(dv[2], dv[1] - 1, dv[0]);
            return d < hoje;
          }
          return true;
        });
      }
      return peds;
    }

    function renderKanban() {
      const cols = ["Pendente", "Em andamento", "Finalizado", "Cancelado"];
      const filtered = getFilteredPeds();
      const batch = filtered.slice(0, pedOffset + PED_PAGE);

      cols.forEach(col => {
        const cards = batch.filter(p => p["Status"] === col);
        const allColCards = filtered.filter(p => p["Status"] === col);
        const cntEl = document.getElementById("cnt-" + col);
        if (cntEl) cntEl.textContent = allColCards.length;
        const container = document.getElementById("cards-" + col);
        if (container) container.innerHTML = cards.map(p => buildKCard(p, col)).join("");
      });

      const showMore = batch.length < filtered.length;
      document.getElementById("loadMoreBtn").style.display = showMore ? "block" : "none";
    }

    function _pedAgeDays(p) {
      const dt = _parsePedDate(p);
      if (!dt) return 0;
      return Math.floor((Date.now() - dt.getTime()) / 86400000);
    }

    function buildKCard(p, col) {
      const id = p["ID Pedido"] || "";
      const next = nextStatus(col);
      const isCancelado = col === "Cancelado";
      const isFinalizado = col === "Finalizado";
      const age = _pedAgeDays(p);
      const ageClass = age === 0 ? "kage-ok" : age <= 2 ? "kage-ok" : age <= 7 ? "kage-warn" : "kage-late";
      const ageTxt = age === 0 ? "hoje" : age + "d";
      return `<div class="kcard"
       draggable="${!isCancelado}"
       data-id="${id}"
       data-col="${col}"
       ondragstart="dStart(event,'${id}')"
       ontouchstart="tStart(event,'${id}','${col}')"
       ontouchmove="tMove(event)"
       ontouchend="tEnd(event)"
       style="${isCancelado ? "opacity:.65;border-color:rgba(244,67,54,.2)" : ""}">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div class="kid">${id}</div>
      <span class="kage ${ageClass}">${ageTxt}</span>
    </div>
    <div class="knm">${p["Nome Cliente"] || "—"}</div>
    <div class="ktel">📱 ${p["Telefone"] || ""}</div>
    <div class="kitens">${(p["Itens"] || "").split("|")[0]}</div>
    <div class="ktot">${fmt(p["Total (R$)"])}</div>
    <div class="kbtns">
      <button class="kbtn kb-info" data-ped-id="${id}">ℹ️ Detalhes</button>
      ${isCancelado ? `<button class="kbtn kb-rev" data-ped-id="${id}" data-next="Pendente" style="color:var(--c);border-color:var(--c)">↩ Reativar</button>` : ""}
      ${!isFinalizado && !isCancelado ? `<button class="kbtn kb-next" data-ped-id="${id}" data-next="${next}">→ ${next}</button>` : ""}
      <button class="kbtn kb-wpp" data-ped-id="${id}">💬</button>
      ${!isFinalizado && !isCancelado ? `<button class="kbtn kb-can" data-ped-id="${id}">✕</button>` : ""}
    </div>
  </div>`;
    }

    function loadMorePeds() {
      pedOffset += PED_PAGE;
      renderKanban();
    }

    function nextStatus(s) { return s === "Pendente" ? "Em andamento" : "Finalizado"; }

    function checkBaixaAntesFinalizar(id, onProsseguir) {
      const baixasDoPedido = _baixasCache.filter(b => String(b["ID_Pedido"] || "") === String(id));
      const temBaixa = baixasDoPedido.length > 0;
      if (temBaixa) {
        // Verifica se o valor pago cobre o total do pedido
        const ped = allPeds.find(p => p["ID Pedido"] === id);
        const totalPedido = Number((ped && ped["Total (R$)"]) || 0);
        const totalPago = baixasDoPedido.reduce((s, b) => s + Number(b["Valor_Final_Recebido"] || 0), 0);
        if (totalPedido > 0 && totalPago < totalPedido * 0.99) {
          const saldo = totalPedido - totalPago;
          toastConfirm(
            `⚠️ <b>Saldo pendente de ${fmt(saldo)}</b> (pago ${fmt(totalPago)} de ${fmt(totalPedido)}).<br>Deseja finalizar mesmo assim?`,
            "💰 Registrar Baixa do Saldo",
            "✅ Finalizar (Cortesia/Desconto)",
            () => { if (ped) { openDetail(ped); setTimeout(() => document.getElementById("bxValorPago")?.focus(), 400); } },
            onProsseguir
          );
          return;
        }
        onProsseguir();
        return;
      }
      toastConfirm(
        "⚠️ <b>Nenhuma baixa registrada</b> para este pedido.<br>O cliente pagou? Registre a baixa para controle financeiro.",
        "📋 Registrar Baixa Agora",
        "✅ Finalizar como Cortesia/Brinde",
        () => {
          const ped = allPeds.find(p => p["ID Pedido"] === id);
          if (ped) { openDetail(ped); setTimeout(() => document.getElementById("bxValorPago")?.focus(), 400); }
        },
        onProsseguir
      );
    }

    async function moverPed(id, status) {
      if (status === "Finalizado") {
        checkBaixaAntesFinalizar(id, () => _executarMoverPed(id, status));
        return;
      }
      _executarMoverPed(id, status);
    }

    async function _executarMoverPed(id, status) {
      if (status === "Cancelado") {
        const prev = (allPeds.find(p => p["ID Pedido"] === id) || {}).Status;
        allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: "Cancelado" } : p);
        renderKanban();
        toastUndo("Pedido cancelado.",
          async () => {
            try {
              const res = await apiGet("atualizarStatus", { id, status: "Cancelado" });
              if (!res.ok) { allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: prev } : p); renderKanban(); toast(res.error || "Erro", "err"); }
            } catch (e) { allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: prev } : p); renderKanban(); toast("Erro de conexão", "err"); }
          },
          () => { allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: prev } : p); renderKanban(); }
        );
        return;
      }
      try {
        const res = await apiGet("atualizarStatus", { id, status });
        if (res.ok) {
          allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: status } : p);
          renderKanban();
          const ped = allPeds.find(p => p["ID Pedido"] === id);
          if (ped && ped["Telefone"] && status === "Em andamento") {
            _offerWppStatusChange(ped, status);
          } else {
            toast("Status atualizado ✅");
          }
        } else toast(res.error || "Erro", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
    }

    function _offerWppStatusChange(ped, status) {
      const msgs = {
        "Em andamento": `Olá ${ped["Nome Cliente"] || ""}! 👋\nSeu pedido *${ped["ID Pedido"]}* foi confirmado e está sendo preparado.\n\nQualquer dúvida, pode falar aqui! 😊`,
        "Finalizado": `Olá ${ped["Nome Cliente"] || ""}! ✅\nSeu pedido *${ped["ID Pedido"]}* foi finalizado com sucesso.\n\nObrigado pela preferência na GJ Store! 🛒`
      };
      const msg = msgs[status];
      if (!msg) { toast("Status atualizado ✅"); return; }
      const tel = String(ped["Telefone"] || "").replace(/\D/g, "");
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--d2);border:1px solid var(--border);border-radius:14px;padding:14px 16px;z-index:2000;max-width:320px;width:90%";
      el.innerHTML = `<div style="font-size:12px;font-weight:700;margin-bottom:8px">✅ Status → <b>${status}</b> · Avisar cliente?</div>
        <div class="wpp-preview" style="font-size:11px;color:var(--muted);background:rgba(255,255,255,.04);border-radius:8px;padding:8px;margin-bottom:10px;max-height:80px;overflow:auto;white-space:pre-wrap"></div>
        <div style="display:flex;gap:8px">
          <button class="_wsc-send" style="flex:1;background:rgba(37,211,102,.18);border:none;color:#25d366;padding:8px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer">💬 Enviar WPP</button>
          <button class="_wsc-skip" style="flex:1;background:var(--d3);border:none;color:var(--muted);padding:8px;border-radius:8px;font-size:12px;cursor:pointer">Pular</button>
        </div>`;
      el.querySelector(".wpp-preview").textContent = msg;
      el.querySelector("._wsc-send").addEventListener("click", () => {
        window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank");
        el.remove();
      });
      el.querySelector("._wsc-skip").addEventListener("click", () => { el.remove(); toast("Status atualizado ✅"); });
      document.body.appendChild(el);
      setTimeout(() => { if (el.parentNode) { el.remove(); toast("Status atualizado ✅"); } }, 8000);
    }

    function wppPed(tel, nome) {
      if (!tel) return;
      window.open(`https://wa.me/55${tel.replace(/\D/g, "")}?text=Olá+${encodeURIComponent(nome)}!+Atualização+do+seu+pedido+GJ+Store:`, "_blank");
    }

    // DRAG desktop
    function dStart(e, id) { dragId = id; e.target.classList.add("dragging"); }
    function dOver(e) { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }
    function dLeave(e) { e.currentTarget.classList.remove("drag-over"); }
    async function dDrop(e, status) {
      e.preventDefault();
      e.currentTarget.classList.remove("drag-over");
      document.querySelectorAll(".kcard").forEach(c => c.classList.remove("dragging"));
      if (dragId) await moverPed(dragId, status);
      dragId = null;
    }

    // TOUCH kanban
    function tStart(e, id, col) { touchPedId = id; touchCol = col; touchStartY = e.touches[0].clientY; }
    function tMove(e) { e.preventDefault(); }
    function tEnd(e) {
      if (!touchPedId) return;
      const dy = e.changedTouches[0].clientY - touchStartY;
      const cols = ["Pendente", "Em andamento", "Finalizado"];
      const ci = cols.indexOf(touchCol);
      if (dy < -60 && ci < cols.length - 1) moverPed(touchPedId, cols[ci + 1]);
      else if (dy > 60 && ci > 0) moverPed(touchPedId, cols[ci - 1]);
      touchPedId = null;
    }

    // DETAIL OVERLAY
    function openDetail(p) {
      currentDetailPed = p;
      document.getElementById("detTitle").textContent = "Pedido " + (p["ID Pedido"] || "");

      const total = Number(p["Total (R$)"] || 0);
      const dv = p["Data_Vencimento"] || "";
      const diasAtraso = calcDiasAtraso(dv);

      // Auto-detecta status: atrasado se há dias de atraso, senão "No Prazo"
      baixaStatusSel = diasAtraso > 0 ? "Atrasado SEM Taxa" : "No Prazo";
      document.querySelectorAll(".bso").forEach(b => {
        b.classList.toggle("on", b.dataset.status === baixaStatusSel);
      });

      document.getElementById("detGrid").innerHTML = `
    <div class="det-cell"><div class="det-lbl">Data/Hora</div><div class="det-val">${p["Data/Hora"] || "—"}</div></div>
    <div class="det-cell"><div class="det-lbl">Status</div><div class="det-val"><span class="badge ${bc(p["Status"])}">${p["Status"] || "—"}</span></div></div>
    <div class="det-cell"><div class="det-lbl">Cliente</div><div class="det-val">${p["Nome Cliente"] || "—"} ${scoreFromBaixas(p["Nome Cliente"])}</div></div>
    <div class="det-cell"><div class="det-lbl">Telefone</div><div class="det-val">${p["Telefone"] || "—"}</div></div>
    <div class="det-cell"><div class="det-lbl">Subtotal</div><div class="det-val">${fmt(p["Subtotal (R$)"] || p["Subtotal"] || 0)}</div></div>
    <div class="det-cell"><div class="det-lbl">Desconto</div><div class="det-val">${fmt(p["Desconto (R$)"] || p["Desconto"] || 0)}</div></div>
    <div class="det-cell"><div class="det-lbl">Frete</div><div class="det-val">${p["Tipo Frete"] || p["tipoFrete"] || "—"}</div></div>
    <div class="det-cell"><div class="det-lbl">Total</div><div class="det-val green">${fmt(total)}</div></div>
    <div class="det-cell"><div class="det-lbl">Pagamento</div><div class="det-val">${p["Forma Pagamento"] || "—"}</div></div>
    <div class="det-cell"><div class="det-lbl">Vencimento</div><div class="det-val orange">${dv || "—"}${diasAtraso > 0 ? " (" + diasAtraso + "d atraso)" : ""}</div></div>
    ${p["Fornecedor_Selecionado"] ? `<div class="det-cell"><div class="det-lbl">Fornecedor</div><div class="det-val">${p["Fornecedor_Selecionado"]}</div></div>` : ""}
    ${p["Custo_Lote"] ? `<div class="det-cell"><div class="det-lbl">Custo Lote</div><div class="det-val">${fmt(p["Custo_Lote"])}</div></div>` : ""}
  `;

      // Order journey timeline
      const jEl = document.getElementById("detJourney");
      if (jEl) {
        const status = p["Status"] || "";
        const isFin = status === "Finalizado";
        const isCan = status === "Cancelado";
        const isEm = status === "Em andamento" || isFin;
        const jSteps = [
          { lbl:"Criado", icon:"📝", done:true, date: p["Data_Criacao"] || String(p["Data/Hora"]||"").split(" ")[0] },
          { lbl:"Em andamento", icon:"⚙️", done:isEm, date: p["Data_Confirmacao"] || (isEm && !isFin ? "hoje" : null) },
          { lbl: isCan ? "Cancelado" : "Finalizado", icon: isCan ? "❌" : "✅", done:isFin||isCan, date: p["Data_Finalizacao"] || null }
        ];
        jEl.innerHTML = `<div class="ped-timeline">${jSteps.map((s, i) => `
          <div class="ptl-step">
            <div class="ptl-dot ${s.done ? "done" : "future"}">${s.icon}</div>
            <div class="ptl-lbl">${s.lbl}</div>
            <div class="ptl-date">${s.date || "—"}</div>
          </div>
          ${i < jSteps.length - 1 ? `<div class="ptl-line ${jSteps[i+1].done ? "done" : "future"}"></div>` : ""}`).join("")}
        </div>`;
      }

      document.getElementById("detItens").innerHTML = (p["Itens"] || "—").split("|").map(i => `• ${i.trim()}`).join("<br>");
      document.getElementById("detFornecedor").value = p["Fornecedor_Selecionado"] || "";
      document.getElementById("detCusto").value = p["Custo_Lote"] || "";

      const pedDates = getPedDatesLocal(p["ID Pedido"] || "");
      document.getElementById("detDataAcordada").value = pedDates.acordada || "";
      document.getElementById("detDataLembrete").value = pedDates.lembrete || "";
      renderDetDatesTimeline(p);

      updateInterestPreview(total, diasAtraso);
      buildDetActions(p);

      // Pré-preenche valor com o total do pedido e reseta campos secundários
      const bxValEl = document.getElementById("bxValorPago");
      if (bxValEl) bxValEl.value = total > 0 ? total.toFixed(2) : "";
      const bxWppEl = document.getElementById("bxWppRow");
      if (bxWppEl) { bxWppEl.style.display = "none"; bxWppEl.innerHTML = ""; }
      const bxIntWrap = document.getElementById("bxIntervaloWrap");
      if (bxIntWrap) bxIntWrap.style.display = "none";

      document.getElementById("detailOverlay").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function calcDiasAtraso(dvStr) {
      if (!dvStr) return 0;
      const parts = String(dvStr).split("/");
      if (parts.length !== 3) return 0;
      const dv = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      if (isNaN(dv.getTime())) return 0;
      const hoje = new Date(); hoje.setHours(0, 0, 0, 0); dv.setHours(0, 0, 0, 0);
      return Math.max(0, Math.floor((hoje - dv) / (1000 * 60 * 60 * 24)));
    }

    function buildDetActions(p) {
      const col = p["Status"];
      let html = "";
      if (col === "Pendente") html += `<button class="det-btn db-next" data-det-move="Em andamento">→ Em Andamento</button>`;
      if (col === "Em andamento") html += `<button class="det-btn db-next" data-det-move="Finalizado">→ Finalizado</button>`;
      html += `<button class="det-btn db-print" data-det-action="printA4">🖨️ Imprimir A4</button>`;
      html += `<button class="det-btn db-print" data-det-action="printTermica">📄 Térmica/PDF</button>`;
      html += `<button class="det-btn db-drive" data-det-action="uploadDriveWpp">📤 Drive+WPP</button>`;
      html += `<button class="det-btn db-wpp" data-det-action="wppPed">💬 WhatsApp</button>`;
      if (col !== "Finalizado" && col !== "Cancelado") html += `<button class="det-btn db-can" data-det-move="Cancelado">✕ Cancelar</button>`;
      document.getElementById("detActions").innerHTML = html;
    }

    async function detMove(id, status) {
      if (status === "Finalizado") {
        checkBaixaAntesFinalizar(id, () => _detMoveExec(id, status));
        return;
      }
      _detMoveExec(id, status);
    }

    async function _detMoveExec(id, status) {
      const forn = document.getElementById("detFornecedor").value.trim();
      const custo = document.getElementById("detCusto").value;
      if (status === "Cancelado") {
        toastUndo("Pedido cancelado.",
          async () => {
            try {
              const res = await apiGet("atualizarStatus", { id, status, fornecedor: forn, custoLote: custo });
              if (res.ok) {
                allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: status, Fornecedor_Selecionado: forn, Custo_Lote: custo } : p);
                currentDetailPed = { ...currentDetailPed, Status: status };
                buildDetActions(currentDetailPed);
                renderKanban();
              } else toast(res.error || "Erro", "err");
            } catch (e) { toast("Erro de conexão", "err"); }
          }
        );
        return;
      }
      try {
        const res = await apiGet("atualizarStatus", { id, status, fornecedor: forn, custoLote: custo });
        if (res.ok) {
          allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: status, Fornecedor_Selecionado: forn, Custo_Lote: custo } : p);
          currentDetailPed = { ...currentDetailPed, Status: status };
          buildDetActions(currentDetailPed);
          renderKanban();
          if (currentDetailPed["Telefone"] && status === "Em andamento") {
            _offerWppStatusChange(currentDetailPed, status);
          } else {
            toast("Status atualizado ✅");
          }
        } else toast(res.error || "Erro", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
    }

    function selBaixaStatus(el, status) {
      baixaStatusSel = status;
      document.querySelectorAll(".bso").forEach(b => b.classList.remove("on"));
      el.classList.add("on");
      // Mostra intervalo apenas para atrasado COM taxa (juros calculados por dia)
      const bxIntWrap = document.getElementById("bxIntervaloWrap");
      if (bxIntWrap) bxIntWrap.style.display = status === "Atrasado COM Taxa" ? "block" : "none";
      const p = currentDetailPed;
      const total = Number(p ? p["Total (R$)"] || 0 : 0);
      const dv = p ? p["Data_Vencimento"] || "" : "";
      updateInterestPreview(total, calcDiasAtraso(dv));
    }

    function updateInterestPreview(total, diasAtraso) {
      const el = document.getElementById("interestPreview");
      if (baixaStatusSel === "Atrasado COM Taxa" && diasAtraso > 0) {
        const juros = total * (TAXA_PADRAO / 100) * diasAtraso;
        el.textContent = `${diasAtraso} dias de atraso · Juros: ${fmt(juros)} · Total Final: ${fmt(total + juros)}`;
        el.style.color = "var(--r)";
      } else if (baixaStatusSel === "Atrasado SEM Taxa") {
        el.textContent = diasAtraso > 0 ? `${diasAtraso} dias de atraso · Sem cobrança de juros` : "Pagamento atrasado sem multa";
        el.style.color = "var(--o)";
      } else if (baixaStatusSel === "Antecipado") {
        el.textContent = "Pagamento antecipado 🎉";
        el.style.color = "var(--g)";
      } else {
        el.textContent = "Pagamento no prazo ✅";
        el.style.color = "var(--c)";
      }
    }

    async function confirmarBaixa() {
      if (!currentDetailPed) return;
      const id = currentDetailPed["ID Pedido"] || "";
      const dv = currentDetailPed["Data_Vencimento"] || "";
      const diasAtraso = calcDiasAtraso(dv);
      const valorPagoRaw = document.getElementById("bxValorPago").value;
      const intervaloDias = Number(document.getElementById("bxIntervalo").value) || 30;
      const btn = document.getElementById("baixaBtn");
      btn.disabled = true; btn.textContent = "⏳ Processando...";
      document.getElementById("bxWppRow").style.display = "none";
      try {
        const params = { idPedido: id, statusPagamento: baixaStatusSel, diasAtraso, intervaloDias };
        if (valorPagoRaw !== "") params.valorPago = Number(valorPagoRaw);
        const res = await apiGet("darBaixa", params);
        if (res.ok) {
          // Atualiza cache local para que checkBaixaAntesFinalizar funcione imediatamente
          _baixasCache.push({
            "ID_Pedido": id,
            "Nome_Cliente": res.nomeCliente || (currentDetailPed && currentDetailPed["Nome Cliente"]) || "",
            "Valor_Final_Recebido": String(res.parcial ? res.valorPago : res.valorFinal),
            "Status_Pagamento": baixaStatusSel,
            "Dias_Atraso": String(diasAtraso),
            "Taxa_Aplicada_RS": "0",
            "Data_Baixa_Efetiva": new Date().toLocaleDateString("pt-BR")
          });
          if (res.parcial) {
            toast("Baixa parcial registrada ✅ · Pago: " + fmt(res.valorPago) + " · Saldo: " + fmt(res.saldoRestante));
            // Mostra botão WhatsApp extrato
            const tel = (res.telefone || "").replace(/\D/g, "");
            const msg = encodeURIComponent(
              `✅ *GJ Store — Extrato de Pagamento*\n\n` +
              `👤 ${res.nomeCliente || currentDetailPed["Nome Cliente"] || ""}\n` +
              `📋 Pedido: #${id}\n\n` +
              `💰 *Valor Pago:* R$ ${Number(res.valorPago).toLocaleString("pt-BR",{minimumFractionDigits:2})}\n` +
              `📊 *Saldo Restante:* R$ ${Number(res.saldoRestante).toLocaleString("pt-BR",{minimumFractionDigits:2})}\n` +
              `📅 *Próximo Vencimento:* ${res.proximaVencimento || "—"}\n\n` +
              `_Obrigado pela confiança! 🙏_`
            );
            document.getElementById("bxWppRow").innerHTML = tel
              ? `<a href="https://wa.me/55${tel}?text=${msg}" target="_blank" style="display:block;background:rgba(37,211,102,.15);border:1px solid #25d366;color:#25d366;border-radius:8px;padding:8px 12px;text-decoration:none;font-size:13px;font-weight:600;text-align:center">💬 Enviar Extrato de Parcelas</a>`
              : "";
            document.getElementById("bxWppRow").style.display = "block";
            // Não fecha o detalhe — pedido ainda está em andamento
            allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: "Em andamento" } : p);
            renderKanban();
          } else {
            toast("Baixa confirmada ✅ · Total: " + fmt(res.valorFinal));
            allPeds = allPeds.map(p => p["ID Pedido"] === id ? { ...p, Status: "Finalizado" } : p);
            renderKanban();
            closeDetail();
            showBaixaReceipt({ ...res, idPedido: id }, currentDetailPed);
          }
        } else toast(res.error || "Erro", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
      btn.disabled = false; btn.textContent = "✅ Confirmar Baixa";
    }

    function closeDetailF(e) { if (e.target === document.getElementById("detailOverlay")) closeDetail(); }
    function closeDetail() { document.getElementById("detailOverlay").classList.add("hidden"); document.body.style.overflow = ""; }

    function showBaixaReceipt(res, ped) {
      const tel = ((ped && ped["Telefone"]) || (res && res.telefone) || "").replace(/\D/g, "");
      const nome = (ped && ped["Nome Cliente"]) || res.nomeCliente || "—";
      const idPed = res.idPedido || (ped && ped["ID Pedido"]) || "—";
      const valor = fmt(res.valorFinal || res.valorPago || 0);
      const pag = ped ? (ped["Forma Pagamento"] || "—") : "—";
      const now = new Date().toLocaleString("pt-BR");
      const msg = encodeURIComponent(
        `✅ *Comprovante de Pagamento — GJ Store*\n\n` +
        `👤 *Cliente:* ${nome}\n📋 *Pedido:* #${idPed}\n` +
        `💰 *Valor Pago:* ${valor}\n💳 *Forma:* ${pag}\n📅 *Data:* ${now}\n\n` +
        `✅ Pagamento confirmado!\n_GJ Store — Obrigado pela preferência 🙏_`
      );
      const existing = document.getElementById("baixaReceiptModal");
      if (existing) existing.remove();
      const modal = document.createElement("div");
      modal.id = "baixaReceiptModal";
      modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center";
      modal.innerHTML = `
        <div style="background:var(--d2);border-radius:20px 20px 0 0;padding:24px;width:100%;max-width:480px;border-top:2px solid var(--g)">
          <div style="text-align:center;margin-bottom:16px">
            <div style="font-size:48px">✅</div>
            <div style="font-family:var(--H);font-weight:900;font-size:18px;color:var(--g);margin-top:6px">Baixa Confirmada!</div>
          </div>
          <div style="background:var(--d3);border-radius:12px;padding:14px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted);font-size:13px">Cliente</span><span style="font-weight:700;font-size:13px">${nome}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted);font-size:13px">Pedido</span><span style="font-weight:700;font-size:13px">#${idPed}</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="color:var(--muted);font-size:13px">Valor</span><span style="font-family:var(--H);font-weight:900;font-size:16px;color:var(--g)">${valor}</span></div>
            <div style="display:flex;justify-content:space-between"><span style="color:var(--muted);font-size:13px">Pagamento</span><span style="font-weight:600;font-size:13px">${pag}</span></div>
          </div>
          <div style="display:flex;gap:10px">
            ${tel ? `<a href="https://wa.me/55${tel}?text=${msg}" target="_blank" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;background:rgba(37,211,102,.15);border:1px solid #25d366;color:#25d366;border-radius:12px;padding:12px;text-decoration:none;font-weight:700;font-size:14px">💬 Enviar WPP</a>` : ""}
            <button onclick="document.getElementById('baixaReceiptModal').remove()" style="flex:1;background:var(--d3);color:var(--muted);border:none;border-radius:12px;padding:12px;font:700 14px var(--B);cursor:pointer">Fechar</button>
          </div>
        </div>`;
      modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    }

    // Swipe detail sheet
    let dsy = 0;
    document.getElementById("detailSheet").addEventListener("touchstart", e => { dsy = e.touches[0].clientY; }, { passive: true });
    document.getElementById("detailSheet").addEventListener("touchend", e => {
      if (e.changedTouches[0].clientY - dsy > 80 && document.getElementById("detailSheet").scrollTop === 0) closeDetail();
    });

    // A4 PRINT
    function printA4() {
      const p = currentDetailPed;
      if (!p) return;
      const id = p["ID Pedido"] || "";
      const itensHtml = (p["Itens"] || "").split("|").map(item => {
        const t = item.trim();
        const m = t.match(/^(.+?)\s+x(\d+)$/);
        return `<tr><td class="pa-table">${m ? m[1] : t}</td><td>${m ? m[2] : 1}</td></tr>`;
      }).join("");
      const total = Number(p["Total (R$)"] || 0);
      const garantia = "90 dias contra defeitos de fabricação";
      document.getElementById("printArea").innerHTML = `
    <div class="pa-header">
      <div class="pa-logo">GJ STORE</div>
      <div class="pa-id">Pedido #${id}<br><small>${p["Data/Hora"] || ""}</small></div>
    </div>
    <div class="pa-info-grid">
      <div class="pa-info-cell"><div class="pa-info-lbl">Cliente</div><div class="pa-info-val">${p["Nome Cliente"] || "—"}</div></div>
      <div class="pa-info-cell"><div class="pa-info-lbl">Telefone</div><div class="pa-info-val">${p["Telefone"] || "—"}</div></div>
      <div class="pa-info-cell"><div class="pa-info-lbl">Pagamento</div><div class="pa-info-val">${p["Forma Pagamento"] || "—"}</div></div>
      <div class="pa-info-cell"><div class="pa-info-lbl">Status</div><div class="pa-info-val">${p["Status"] || "—"}</div></div>
    </div>
    <table class="pa-table">
      <thead><tr><th>Item</th><th>Qtd</th></tr></thead>
      <tbody>${itensHtml}</tbody>
    </table>
    <div class="pa-total">TOTAL: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
    <div class="pa-garantia"><strong>Garantia:</strong> ${garantia}</div>
    <div class="pa-footer">GJ Store · 55 21 97036-3062 · Documento gerado em ${new Date().toLocaleString("pt-BR")}</div>
  `;
      window.print();
    }

    // THERMAL / PDF
    async function printTermica() {
      if (!currentDetailPed) return;
      const p = currentDetailPed;
      const id = p["ID Pedido"] || "";
      const total = Number(p["Total (R$)"] || 0);

      // Carrega libs dinamicamente se necessário
      if (!window.html2canvas) {
        await loadScript("https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js");
      }
      if (!window.jspdf) {
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
      }

      const div = document.createElement("div");
      div.id = "thermalPreview";
      div.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:300px;background:#fff;color:#000;font-family:monospace;font-size:12px;padding:12px;";
      div.innerHTML = `
    <div style="text-align:center;font-size:18px;font-weight:900;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px">GJ STORE</div>
    <div style="font-size:10px;text-align:center;margin-bottom:8px">Pedido #${id} · ${p["Data/Hora"] || ""}</div>
    <div><b>Cliente:</b> ${p["Nome Cliente"] || "—"}</div>
    <div><b>Tel:</b> ${p["Telefone"] || "—"}</div>
    <div style="border-top:1px dashed #000;margin:8px 0;padding-top:8px">
      ${(p["Itens"] || "").split("|").map(i => `<div>• ${i.trim()}</div>`).join("")}
    </div>
    <div style="border-top:2px solid #000;margin-top:8px;padding-top:8px;font-size:15px;font-weight:900;text-align:right">
      TOTAL: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
    </div>
    <div style="font-size:10px;text-align:center;margin-top:8px">Garantia: 90 dias · GJ Store</div>
  `;
      document.body.appendChild(div);

      try {
        const canvas = await html2canvas(div, { scale: 2, useCORS: true, backgroundColor: "#fff" });
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [canvas.width / 2, canvas.height / 2] });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, canvas.width / 2, canvas.height / 2);
        pdf.save("Comprovante_" + id + ".pdf");
        toast("PDF baixado ✅");
      } catch (e) { toast("Erro ao gerar PDF", "err"); }
      div.remove();
    }

    async function uploadDriveWpp(idPedido, tel, nome) {
      toast("Gerando comprovante...");
      try {
        const res = await apiGet("gerarComprovanteDrive", { idPedido });
        if (res.ok) {
          const msg = encodeURIComponent(`Olá ${nome}! Segue o comprovante do seu pedido GJ Store: ${res.url}`);
          const wppUrl = `https://wa.me/55${tel.replace(/\D/g, "")}?text=${msg}`;
          window.open(wppUrl, "_blank");
          toast("Comprovante gerado ✅");
        } else toast(res.error || "Erro ao gerar", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
    }

    function loadScript(src) {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
        const s = document.createElement("script"); s.src = src;
        s.onload = resolve; s.onerror = reject;
        document.head.appendChild(s);
      });
    }

    // FINANCEIRO
    function getPedDatesLocal(idPed) {
      try { return JSON.parse(localStorage.getItem("gj_peddates_" + idPed) || "{}"); } catch(e) { return {}; }
    }
    function savePedDates() {
      if (!currentDetailPed) return;
      const id = currentDetailPed["ID Pedido"] || "";
      if (!id) return;
      const acordada = document.getElementById("detDataAcordada").value;
      const lembrete = document.getElementById("detDataLembrete").value;
      localStorage.setItem("gj_peddates_" + id, JSON.stringify({ acordada, lembrete }));
      renderDetDatesTimeline(currentDetailPed);
      toast("Datas salvas ✅");
    }
    function renderDetDatesTimeline(p) {
      const el = document.getElementById("detDatesTimeline");
      if (!el) return;
      const id = p["ID Pedido"] || "";
      const extras = getPedDatesLocal(id);
      const dataCompra = p["Data/Hora"] ? String(p["Data/Hora"]).split(" ")[0] : null;
      const dataVenc = p["Data_Vencimento"] || null;
      const dias = calcDiasAtraso(dataVenc);
      const steps = [
        { lbl:"Compra", date:dataCompra, icon:"📝", cls: dataCompra ? "done" : "future" },
        { lbl:"Acordado", date:extras.acordada||null, icon:"🤝", cls: extras.acordada ? "done" : "future" },
        { lbl:"Lembrete", date:extras.lembrete||null, icon:"🔔", cls: extras.lembrete ? "done" : "future" },
        { lbl:"Vencimento", date:dataVenc, icon:"⏰", cls: dataVenc ? (dias > 0 ? "late" : "done") : "future" },
        { lbl:"Pagamento", date:null, icon:"💰", cls:"future" }
      ];
      el.innerHTML = `<div class="fin-timeline" style="margin-top:8px">${
        steps.map(s => `<div class="fin-tl-step"><div class="fin-tl-dot ${s.cls}">${s.icon}</div><div class="fin-tl-lbl">${s.lbl}</div><div class="fin-tl-date">${s.date || "—"}</div></div>`).join("")
      }</div>`;
    }

    function setFinFilter(type, btn, val) {
      _finFilter = type;
      _finFilterVal = val || null;
      document.querySelectorAll(".fin-filter-btn").forEach(b => b.classList.remove("on"));
      if (btn) btn.classList.add("on");
      _renderFinCards();
    }

    let _allBaixasCache = [];

    async function loadFin() {
      try {
        if (!allPeds.length) {
          const rp = await apiGet("getPedidos");
          allPeds = rp.pedidos || [];
        }
        const r = await apiGet("getFinanceiro");
        _allBaixasCache = r.baixas || [];
        _baixasCache = _allBaixasCache;
        _renderFinCards();
      } catch (e) {
        document.getElementById("finCards").innerHTML = `<div style="text-align:center;color:var(--r);padding:24px">Erro ao carregar</div>`;
      }
    }

    function _renderFinCards() {
      const allB = _allBaixasCache;
      const now = new Date();
      const mesAtual = now.getMonth(), anoAtual = now.getFullYear();
      const mesAnt = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoAnt = mesAtual === 0 ? anoAtual - 1 : anoAtual;

      let baixas = allB;
      if (_finFilter === "mes") {
        baixas = allB.filter(b => {
          const d = String(b["Data_Baixa_Efetiva"] || "").split("/");
          return d.length >= 3 && Number(d[1]) - 1 === mesAtual && Number(d[2]) === anoAtual;
        });
      } else if (_finFilter === "ultmes") {
        baixas = allB.filter(b => {
          const d = String(b["Data_Baixa_Efetiva"] || "").split("/");
          return d.length >= 3 && Number(d[1]) - 1 === mesAnt && Number(d[2]) === anoAnt;
        });
      } else if (_finFilter === "pend") {
        // Show orders with unpaid balance from allPeds
        const paidIds = new Set(allB.filter(b => b["Status_Pagamento"] !== "Pago Parcial").map(b => b["ID_Pedido"]));
        const pendPeds = allPeds.filter(p => !["Finalizado", "Cancelado"].includes(p["Status"]));
        const pendentes = pendPeds.filter(p => !paidIds.has(p["ID Pedido"]));
        const totalPend = pendentes.reduce((s, p) => s + Number(p["Total (R$)"] || 0), 0);
        const el = document.getElementById("finTotalPend"); if (el) el.textContent = fmt(totalPend);
        document.getElementById("finTotalRec").textContent = fmt(0);
        document.getElementById("finTotalJuros").textContent = fmt(0);
        document.getElementById("finCards").innerHTML = !pendentes.length
          ? `<div style="text-align:center;color:var(--g);padding:32px">✅ Nenhum pendente!</div>`
          : pendentes.map(p => `<div class="fin-card">
              <div class="fin-card-hdr">
                <div><div class="fin-card-nome">${p["Nome Cliente"]||"—"}</div><div class="fin-card-id">Pedido ${p["ID Pedido"]||"—"} · ${p["Status"]||""}</div></div>
                <div style="text-align:right">
                  <div style="font-family:var(--H);font-weight:900;font-size:15px;color:var(--r)">${fmt(p["Total (R$)"])}</div>
                  <div style="font-size:11px;color:var(--muted)">${p["Forma Pagamento"]||"—"}</div>
                  ${p["Data_Vencimento"] ? `<div style="font-size:10px;color:var(--o)">Venc: ${p["Data_Vencimento"]}</div>` : ""}
                </div>
              </div>
            </div>`).join("");
        return;
      } else if (_finFilter === "custom" && _finFilterVal) {
        const [yyyy, mm] = _finFilterVal.split("-");
        baixas = allB.filter(b => {
          const d = String(b["Data_Baixa_Efetiva"] || "").split("/");
          return d.length >= 3 && Number(d[1]) === Number(mm) && Number(d[2]) === Number(yyyy);
        });
      }

      const totalRec = baixas.reduce((s, b) => s + Number(b["Valor_Final_Recebido"] || 0), 0);
      const totalJuros = baixas.reduce((s, b) => s + Number(b["Taxa_Aplicada_RS"] || 0), 0);
      const totalPendVal = allPeds.filter(p => !["Finalizado","Cancelado"].includes(p["Status"]))
        .reduce((s, p) => s + Number(p["Total (R$)"] || 0), 0);
      document.getElementById("finTotalRec").textContent = fmt(totalRec);
      document.getElementById("finTotalJuros").textContent = fmt(totalJuros);
      const pendEl = document.getElementById("finTotalPend"); if (pendEl) pendEl.textContent = fmt(totalPendVal);
      const finColC = s => s === "Antecipado" ? "var(--g)" : s === "No Prazo" ? "var(--c)" : s === "Pago Parcial" ? "var(--o)" : "var(--r)";
      if (!baixas.length) {
        document.getElementById("finCards").innerHTML = `<div style="text-align:center;color:var(--muted);padding:32px">Nenhuma baixa no período selecionado</div>`;
        return;
      }
      document.getElementById("finCards").innerHTML = baixas.map(b => {
        const idPed = b["ID_Pedido"] || "—";
        const ped = allPeds.find(p => p["ID Pedido"] === idPed) || {};
        const dataCompra = ped["Data/Hora"] ? String(ped["Data/Hora"]).split(" ")[0] : null;
        const dataVenc = ped["Data_Vencimento"] || null;
        const dataPag = b["Data_Baixa_Efetiva"] || null;
        const extras = getPedDatesLocal(idPed);
        const dias = Number(b["Dias_Atraso"] || 0);
        const status = b["Status_Pagamento"] || "—";
        const steps = [
          { lbl:"Compra", date:dataCompra, icon:"📝", cls: dataCompra ? "done" : "future" },
          { lbl:"Acordado", date:extras.acordada||null, icon:"🤝", cls: extras.acordada ? "done" : "future" },
          { lbl:"Lembrete", date:extras.lembrete||null, icon:"🔔", cls: extras.lembrete ? "done" : "future" },
          { lbl:"Vencimento", date:dataVenc, icon:"⏰", cls: dataVenc ? (dias > 0 ? "late" : "done") : "future" },
          { lbl:"Pagamento", date:dataPag, icon:"✅", cls: dataPag ? "done" : "future" }
        ];
        return `<div class="fin-card">
          <div class="fin-card-hdr">
            <div><div class="fin-card-nome">${b["Nome_Cliente"] || "—"}</div><div class="fin-card-id">Pedido ${idPed}</div></div>
            <div style="text-align:right">
              <div style="font-family:var(--H);font-weight:900;font-size:15px;color:var(--g)">${fmt(b["Valor_Final_Recebido"])}</div>
              <div style="font-size:11px;font-weight:700;color:${finColC(status)};margin-top:2px">${status}</div>
              ${dias > 0 ? `<div style="font-size:10px;color:var(--r)">${dias}d atraso</div>` : ""}
            </div>
          </div>
          <div class="fin-timeline">${steps.map(s => `
            <div class="fin-tl-step">
              <div class="fin-tl-dot ${s.cls}">${s.icon}</div>
              <div class="fin-tl-lbl">${s.lbl}</div>
              <div class="fin-tl-date">${s.date || "—"}</div>
            </div>`).join("")}
          </div>
        </div>`;
      }).join("");
    }

    // MARKETING
    function initMkt() {
      if (!allProds.length) {
        apiGet("getProdutos").then(r => {
          allProds = r.produtos || [];
          populateMktSel();
        }).catch(() => { });
      } else {
        populateMktSel();
      }
      mktRender();
    }

    function populateMktSel() {
      const sel = document.getElementById("mktProdSel");
      sel.innerHTML = `<option value="">Selecione um produto...</option>` +
        allProds.map(p => `<option value="${p["ID"]}">${p["Nome do Produto"] || "—"}</option>`).join("");
    }

    function setMktSize(size, btn) {
      mktSize = size;
      document.querySelectorAll(".size-btn").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      mktRender();
    }

    function mktRender() {
      const sel = document.getElementById("mktProdSel");
      const prodId = sel.value;
      mktProdData = allProds.find(p => p["ID"] === prodId) || null;

      const headline = document.getElementById("mktHeadline").value || "OFERTA ESPECIAL 🔥";
      const sub = document.getElementById("mktSub").value || "Promoção por tempo limitado";
      const cta = document.getElementById("mktCta").value || "Compre agora!";

      const canvas = document.getElementById("mktCanvas");
      const w = mktSize === "9:16" ? 360 : 540;
      const h = mktSize === "9:16" ? 640 : 540;
      canvas.width = w; canvas.height = h;
      canvas.style.width = Math.min(w, 320) + "px";
      canvas.style.height = (Math.min(w, 320) / w * h) + "px";

      const ctx = canvas.getContext("2d");

      // BG gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#04090f");
      grad.addColorStop(0.5, "#0b1728");
      grad.addColorStop(1, "#08111f");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.strokeStyle = "rgba(0,188,212,0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 36) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += 36) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }

      // Product image
      if (mktProdData && mktProdData["Imagem 1 (URL)"]) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const imgH = Math.floor(h * 0.42);
          const imgY = Math.floor(h * 0.12);
          ctx.save();
          if (mktCfg.blur > 0) ctx.filter = `blur(${mktCfg.blur}px)`;
          ctx.beginPath();
          ctx.roundRect(w * 0.1, imgY, w * 0.8, imgH, 16);
          ctx.clip();
          ctx.drawImage(img, w * 0.1, imgY, w * 0.8, imgH);
          ctx.filter = "none";
          ctx.restore();
          if (mktCfg.overlay > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(w * 0.1, imgY, w * 0.8, imgH, 16);
            ctx.clip();
            ctx.fillStyle = `rgba(4,9,15,${mktCfg.overlay / 100})`;
            ctx.fillRect(w * 0.1, imgY, w * 0.8, imgH);
            ctx.restore();
          }
          drawMktText(ctx, w, h, headline, sub, cta);
        };
        img.onerror = () => { drawMktText(ctx, w, h, headline, sub, cta); };
        img.src = mktProdData["Imagem 1 (URL)"];
      } else {
        drawMktText(ctx, w, h, headline, sub, cta);
      }
    }

    function drawMktText(ctx, w, h, headline, sub, cta) {
      const fontSize = mktCfg.font || 22;
      const textBaseY = h * (mktCfg.textY / 100);

      // GJ logo
      ctx.fillStyle = "#00e676";
      ctx.font = "bold 18px Arial";
      ctx.fillText("GJ STORE", 18, 30);

      // Price
      if (mktProdData) {
        const pr = Number(mktProdData["Preço (R$)"] || 0);
        const pm = Number(mktProdData["Preço Promo (R$)"] || 0);
        const pfv = pm > 0 && pm < pr ? pm : pr;
        const priceGrad = ctx.createLinearGradient(0, 0, w, 0);
        priceGrad.addColorStop(0, "#00e676"); priceGrad.addColorStop(1, "#00bcd4");
        ctx.fillStyle = priceGrad;
        ctx.font = "bold 36px Arial";
        const priceStr = "R$ " + pfv.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        ctx.fillText(priceStr, 18, h * 0.62);
      }

      // Headline
      ctx.fillStyle = "#e2f4ff";
      ctx.font = `bold ${fontSize}px Arial`;
      wrapText(ctx, headline, 18, textBaseY, w - 36, fontSize + 6);

      // Sub
      ctx.fillStyle = "rgba(226,244,255,0.65)";
      const subSize = Math.max(12, fontSize - 7);
      ctx.font = `${subSize}px Arial`;
      wrapText(ctx, sub, 18, textBaseY + fontSize + 10, w - 36, subSize + 4);

      // CTA bar
      const barGrad = ctx.createLinearGradient(0, h - 48, w, h - 48);
      barGrad.addColorStop(0, "#00e676"); barGrad.addColorStop(1, "#00bcd4");
      ctx.fillStyle = barGrad;
      ctx.fillRect(0, h - 48, w, 48);
      ctx.fillStyle = "#04090f";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(cta, w / 2, h - 18);
      ctx.textAlign = "left";

      // Marca d'água J. Stories
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.font = "bold 11px Arial";
      ctx.textAlign = "right";
      ctx.fillText("J. Stories", w - 10, h - 56);
      ctx.textAlign = "left";
    }

    function wrapText(ctx, text, x, y, maxW, lineH) {
      const words = text.split(" ");
      let line = "";
      let cy = y;
      for (const word of words) {
        const test = line + word + " ";
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line.trim(), x, cy);
          line = word + " ";
          cy += lineH;
        } else { line = test; }
      }
      if (line) ctx.fillText(line.trim(), x, cy);
    }

    function mktDownload() {
      const canvas = document.getElementById("mktCanvas");
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "card_" + (mktProdData ? mktProdData["ID"] || "prod" : "prod") + ".png";
        a.click();
        URL.revokeObjectURL(url);
        toast("Card baixado ✅");
      }, "image/png");
    }

    function mktCopyLink() {
      const id = mktProdData ? mktProdData["ID"] || "" : "";
      const url = "https://gjstore.github.io/GJSTORE/?prod=" + encodeURIComponent(id);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => toast("🔗 Link copiado!")).catch(() => toast(url));
      } else {
        toast("Link: " + url);
      }
    }

    // NOVO PEDIDO MANUAL
    let npItems = [];

    let _modoVenda = "A"; // A=PDV, B=Pendente, C=Parcelado

    function setModoVenda(modo) {
      _modoVenda = modo;
      ["A","B","C"].forEach(m => document.getElementById("btnModo"+m).classList.toggle("on", m === modo));
      const info = {
        A: "🛒 <b>PDV:</b> Pedido criado já como Finalizado + baixa registrada automaticamente.",
        B: "📋 <b>Pendente:</b> Pedido entra no kanban como Pendente — fluxo normal.",
        C: "📅 <b>Parcelado:</b> Informe as parcelas e vencimento. Baixas parciais liberadas."
      };
      document.getElementById("modoVendaInfo").innerHTML = info[modo];
      const saveLabels = { A: "🛒 Finalizar Venda", B: "💾 Criar Pedido", C: "📅 Criar Carnê" };
      const saveBtn = document.getElementById("npSaveBtn");
      if (saveBtn) saveBtn.textContent = saveLabels[modo];
      // Modo C: mostrar parcelas; Modo A/B: ocultar (salvo se pagamento for cartão/fiado)
      if (modo === "C") {
        document.getElementById("npParcelasRow").style.display = "block";
        document.getElementById("npPagamento").value = "Fiado/Carnê";
      } else {
        const pag = document.getElementById("npPagamento").value;
        document.getElementById("npParcelasRow").style.display = (pag === "Cartão Crédito" || pag === "Fiado/Carnê") ? "block" : "none";
      }
    }

    async function openNovoPedido() {
      // BUG-05: garante que produtos estejam carregados independente da aba visitada
      if (!allProds.length) {
        const r = await apiGet("getProdutos").catch(() => ({ produtos: [] }));
        allProds = r.produtos || [];
      }
      npItems = [];
      _modoVenda = "A";
      document.getElementById("npNome").value = "";
      document.getElementById("npTel").value = "";
      document.getElementById("npObs").value = "";
      document.getElementById("npVencimento").value = "";
      document.getElementById("npResponsavel").value = "";
      document.getElementById("npProdSearch").value = "";
      document.getElementById("npSearchResults").style.display = "none";
      document.getElementById("npToggleLivre").checked = false;
      document.getElementById("npModoEstoque").style.display = "block";
      document.getElementById("npModoLivre").style.display = "none";
      document.getElementById("npLivreDesc").value = "";
      document.getElementById("npLivreValor").value = "";
      document.getElementById("npPagamento").value = "PIX";
      document.getElementById("npParcelasRow").style.display = "none";
      setModoVenda("A");
      renderNpItems();
      document.getElementById("modal-novo-pedido").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function closeNovoPedido() {
      document.getElementById("modal-novo-pedido").classList.add("hidden");
      document.body.style.overflow = "";
    }

    function npOnPagChange() {
      const pag = document.getElementById("npPagamento").value;
      const showParcelas = pag === "Cartão Crédito" || pag === "Fiado/Carnê";
      document.getElementById("npParcelasRow").style.display = showParcelas ? "block" : "none";
    }

    function npToggleMode() {
      const livre = document.getElementById("npToggleLivre").checked;
      document.getElementById("npModoEstoque").style.display = livre ? "none" : "block";
      document.getElementById("npModoLivre").style.display = livre ? "block" : "none";
    }

    function npAddLivre() {
      const desc = document.getElementById("npLivreDesc").value.trim();
      const valor = Number(document.getElementById("npLivreValor").value) || 0;
      if (!desc) { toast("Informe a descrição do item", "err"); return; }
      npItems.push({ id: "LIVRE_" + Date.now(), nome: desc, preco: valor, qty: 1, livre: true });
      document.getElementById("npLivreDesc").value = "";
      document.getElementById("npLivreValor").value = "";
      renderNpItems();
    }

    function npSearchProds(q) {
      const res = document.getElementById("npSearchResults");
      if (!q.trim()) { res.style.display = "none"; return; }
      const matches = (allProds || []).filter(p =>
        p["Status"] !== "Inativo" &&
        (p["Nome do Produto"] || "").toLowerCase().includes(q.toLowerCase())
      ).slice(0, 8);
      if (!matches.length) { res.style.display = "none"; return; }
      res.innerHTML = matches.map(p => {
        const pn = Number(p["Preço (R$)"] || 0), pr = Number(p["Preço Promo (R$)"] || 0);
        const preco = pr > 0 && pr < pn ? pr : pn;
        return `<div class="np-res-item" data-prod-id="${p["ID"]}">
          <strong>${p["Nome do Produto"] || "—"}</strong>
          <span style="color:var(--g);float:right">${fmt(preco)}</span>
        </div>`;
      }).join("");
      res.style.display = "block";
    }

    function npAddProd(p) {
      const pn = Number(p["Preço (R$)"] || 0), pr = Number(p["Preço Promo (R$)"] || 0);
      const preco = pr > 0 && pr < pn ? pr : pn;
      const existing = npItems.find(i => i.id === String(p["ID"]));
      if (existing) { existing.qty++; }
      else { npItems.push({ id: String(p["ID"]), nome: p["Nome do Produto"] || "—", preco, qty: 1 }); }
      document.getElementById("npProdSearch").value = "";
      document.getElementById("npSearchResults").style.display = "none";
      renderNpItems();
    }

    function removeNpItem(idx) {
      npItems.splice(idx, 1);
      renderNpItems();
    }

    function renderNpItems() {
      const list = document.getElementById("npItemsList");
      if (!npItems.length) {
        list.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:12px">Nenhum item adicionado</div>`;
      } else {
        list.innerHTML = npItems.map((it, i) => `
          <div class="np-item">
            <span class="np-item-nm">${it.nome}${it.livre ? ' <span style="font-size:10px;color:var(--o)">[livre]</span>' : ""}</span>
            <input class="np-item-qty" type="number" min="1" value="${it.qty}" data-idx="${i}">
            <span class="np-item-price">${fmt(it.preco * it.qty)}</span>
            <button class="np-item-del" data-idx="${i}">✕</button>
          </div>`).join("");
      }
      updateNpTotal();
    }

    function npSetQty(idx, val) {
      npItems[idx].qty = Math.max(1, Number(val) || 1);
      updateNpTotal();
    }

    function updateNpTotal() {
      const total = npItems.reduce((s, it) => s + it.preco * it.qty, 0);
      document.getElementById("npTotal").textContent = "Total: " + fmt(total);
    }

    async function salvarNovoPedido() {
      const nome = document.getElementById("npNome").value.trim();
      if (!nome) { toast("Informe o nome do cliente", "err"); return; }
      if (!npItems.length) { toast("Adicione ao menos um item", "err"); return; }
      const saveBtn = document.getElementById("modal-novo-pedido").querySelector(".np-save");
      saveBtn.disabled = true; saveBtn.textContent = "Salvando…";
      const total = npItems.reduce((s, it) => s + it.preco * it.qty, 0);
      const itensStr = npItems.map(it => `${it.nome} x${it.qty}`).join("|");
      const dvRaw = document.getElementById("npVencimento").value;
      let dataVenc = "";
      if (dvRaw) { const [y, m, d] = dvRaw.split("-"); dataVenc = `${d}/${m}/${y}`; }
      const pag = document.getElementById("npPagamento").value;
      const showParcelas = _modoVenda === "C" || pag === "Cartão Crédito" || pag === "Fiado/Carnê";
      const qtdParcelas = showParcelas ? Number(document.getElementById("npQtdParcelas").value) || 1 : 1;
      const intervaloDias = showParcelas ? Number(document.getElementById("npIntervaloDias").value) || 30 : 0;
      const isPDV = _modoVenda === "A";
      try {
        const res = await apiGet("novoPedido", {
          nomeCliente: nome,
          telefone: document.getElementById("npTel").value.trim(),
          itens: itensStr,
          subtotal: total,
          total,
          desconto: 0,
          formaPagamento: pag,
          obs: document.getElementById("npObs").value.trim(),
          dataVencimento: isPDV ? "" : dataVenc,
          qtdParcelas,
          intervaloDias,
          responsavel: document.getElementById("npResponsavel").value.trim(),
          statusInicial: isPDV ? "Finalizado" : "Pendente"
        });
        if (res.ok) {
          if (isPDV && res.idPedido) {
            // PDV: aguarda baixa e exibe recibo
            const tel = document.getElementById("npTel").value.trim();
            try {
              const bxRes = await apiGet("darBaixa", {
                idPedido: res.idPedido,
                valorPago: total,
                statusPagamento: "Antecipado",
                nomeCliente: nome,
                telefone: tel,
                valorOriginal: total,
                diasAtraso: 0
              });
              closeNovoPedido();
              allPeds = [];
              loadPeds();
              showBaixaReceipt(
                { ...bxRes, idPedido: res.idPedido, valorFinal: total },
                { "Nome Cliente": nome, "Telefone": tel, "Forma Pagamento": pag, "ID Pedido": res.idPedido }
              );
            } catch(e) {
              toast("Venda criada, mas erro ao registrar baixa. Registre manualmente.", "err");
              closeNovoPedido();
              allPeds = [];
              loadPeds();
            }
          } else {
            toast("Pedido criado! ✅");
            closeNovoPedido();
            allPeds = [];
            await loadPeds();
          }
        } else toast(res.error || "Erro ao criar pedido", "err");
      } catch (e) { toast("Erro de conexão", "err"); }
      saveBtn.disabled = false;
      saveBtn.textContent = { A: "🛒 Finalizar Venda", B: "💾 Criar Pedido", C: "📅 Criar Carnê" }[_modoVenda] || "💾 Criar Pedido";
    }

    // NOTIFICATION POLLING
    function startNotifPolling() {
      if (notifInterval) clearInterval(notifInterval);
      const poll = async () => {
        if (document.hidden) return;
        try {
          const r = await apiGet("getPedidos", { status: "Pendente" });
          const peds = r.pedidos || [];
          const ids = new Set(peds.map(p => p["ID Pedido"]));
          if (lastKnownPendingIds === null) {
            lastKnownPendingIds = ids;
            return;
          }
          const newPeds = peds.filter(p => !lastKnownPendingIds.has(p["ID Pedido"]));
          if (newPeds.length > 0) {
            const clientName = newPeds[0]["Nome Cliente"] || "Novo cliente";
            if (Notification.permission === "granted") {
              new Notification("🛒 Novo Pedido GJ Store!", { body: clientName + " fez um pedido!" });
            }
            playAlertSound();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            toast("🛒 Novo Pedido! " + clientName);
          }
          lastKnownPendingIds = ids;
        } catch (e) { }
      };
      notifInterval = setInterval(poll, 30000);
      // Resume polling when tab becomes visible again
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) poll();
      });
    }

    function playAlertSound() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        [[1800, 800], [2200, 1000]].forEach(([startF, endF], i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.setValueAtTime(startF, ctx.currentTime + i * 0.18);
          osc.frequency.linearRampToValueAtTime(endF, ctx.currentTime + i * 0.18 + 0.15);
          gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.18);
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.18 + 0.22);
          osc.start(ctx.currentTime + i * 0.18);
          osc.stop(ctx.currentTime + i * 0.18 + 0.22);
        });
      } catch (e) { }
    }

    function updateOnlineStatus() {
      if (_onlineCheckInterval) clearInterval(_onlineCheckInterval);
      const dot = document.getElementById("onlineDot");
      const check = async () => {
        if (!dot) return;
        try {
          const r = await apiGet("ping").catch(() => null);
          const online = r && (r.ok || r.status === "ok" || r.pong);
          dot.style.background = online ? "#00e676" : "#f44336";
          dot.title = online ? "GAS Online" : "GAS Offline";
        } catch {
          dot.style.background = "#f44336";
          dot.title = "GAS Offline";
        }
      };
      check();
      _onlineCheckInterval = setInterval(check, 120000);
    }

    async function loadAband() {
      const el = document.getElementById("daband");
      if (!el) return;
      try {
        const r = await apiGet("getCarrinhosAbandonados").catch(() => null);
        if (!r || r.error || !r.carrinhos) {
          el.innerHTML = `<div class="empty" style="color:var(--muted)">Sem carrinhos abandonados</div>`;
          return;
        }
        const carrinhos = r.carrinhos || [];
        if (!carrinhos.length) {
          el.innerHTML = `<div class="empty" style="color:var(--g)">✅ Nenhum carrinho abandonado!</div>`;
          return;
        }
        el.innerHTML = carrinhos.map(c => {
          const tel = String(c.telefone || c.tel || "").replace(/\D/g, "");
          const msg = encodeURIComponent(`Oi ${c.nome || ""}! 👋 Você deixou itens no carrinho da GJ Store.\n\n*${c.itens || "Produtos selecionados"}*\n\nAinda está interessado? Posso reservar pra você! 🛒`);
          const wppUrl = tel ? `https://wa.me/55${tel}?text=${msg}` : null;
          return `<div class="aband-row">
            <div class="aband-info">
              <div class="aband-nm">${c.nome || "Cliente"}</div>
              <div class="aband-sub">${c.itens || "—"} · ${c.data || ""}</div>
            </div>
            <div class="aband-val">${c.total ? fmt(c.total) : "—"}</div>
            ${wppUrl ? `<button onclick="window.open('${wppUrl}','_blank')" style="background:rgba(37,211,102,.14);border:none;color:#25d366;padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">💬 Recuperar</button>` : ""}
          </div>`;
        }).join("");
      } catch (e) {
        el.innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar carrinhos</div>`;
      }
    }

    // ═══════════════════════════════════════════════
    // ═══════════════════════════════════════════════
    // DOCS — ORÇAMENTO / RECIBO DE VENDA
    // ═══════════════════════════════════════════════
    let docItems = [];
    let docType = "orcamento";
    let docPagSel = "PIX";

    function initDoc() {
      // Popula selector de produtos
      const sel = document.getElementById("docProdSel");
      sel.innerHTML = `<option value="">Selecione um produto...</option>` +
        allProds.map(p => `<option value="${p["ID"]}">${p["Nome do Produto"] || "—"} — ${fmt(p["Preço (R$)"])}</option>`).join("");

      // Popula formas de pagamento da Config
      const formas = String(cfg.FORMAS_PAGAMENTO || "PIX,Cartão,Parcelado GJ,Dinheiro,Boleto").split(",").map(s => s.trim()).filter(Boolean);
      const pagEl = document.getElementById("docPagOpts");
      pagEl.innerHTML = formas.map((f, i) =>
        `<button class="doc-pag-opt${i === 0 ? " on" : ""}" onclick="selDocPag(this,'${f}')">${f}</button>`
      ).join("");
      docPagSel = formas[0] || "PIX";

      // Garantia padrão da Config
      const gEl = document.getElementById("docGarantia");
      if (!gEl.value) gEl.value = cfg.TERMO_GARANTIA_GLOBAL || "90 dias contra defeitos de fabricação";

      // Resetar se vazio
      if (!docItems.length) renderDocItems();
      updateDocTotal();
    }

    function toggleAvulsoRow() {
      const btn = document.getElementById("avulsoToggle");
      const row = document.getElementById("docAvulsoRow");
      const estRow = document.getElementById("docEstoqueRow");
      const isOn = row.classList.toggle("show");
      btn.classList.toggle("on", isOn);
      if (estRow) estRow.style.display = isOn ? "none" : "";
    }

    function addDocAvulso() {
      const desc = document.getElementById("avulsoDesc").value.trim();
      const valor = parseFloat(document.getElementById("avulsoValor").value) || 0;
      const qty = Math.max(1, parseInt(document.getElementById("avulsoQty").value) || 1);
      if (!desc) { toast("Informe a descrição do item", "err"); return; }
      if (valor <= 0) { toast("Informe o valor unitário", "err"); return; }
      docItems.push({ id: "avulso_" + Date.now(), nome: desc, img: "", preco: valor, qty });
      renderDocItems(); updateDocTotal();
      document.getElementById("avulsoDesc").value = "";
      document.getElementById("avulsoValor").value = "";
      document.getElementById("avulsoQty").value = 1;
      toast("Item adicionado ✅");
    }

    function setDocType(type, btn) {
      docType = type;
      document.querySelectorAll(".doc-type-btn").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      document.getElementById("docValidadeSec").style.display = type === "orcamento" ? "" : "none";
    }

    function selDocPag(btn, pag) {
      document.querySelectorAll(".doc-pag-opt").forEach(b => b.classList.remove("on"));
      btn.classList.add("on");
      docPagSel = pag;
    }

    function addDocItem() {
      const sel = document.getElementById("docProdSel");
      const qty = Math.max(1, parseInt(document.getElementById("docProdQty").value) || 1);
      const id = sel.value;
      if (!id) { toast("Selecione um produto", "err"); return; }
      const prod = allProds.find(p => p["ID"] === id);
      if (!prod) return;
      const preco = Number(prod["Preço Promo (R$)"] || 0) > 0 && Number(prod["Preço Promo (R$)"]) < Number(prod["Preço (R$)"])
        ? Number(prod["Preço Promo (R$)"])
        : Number(prod["Preço (R$)"] || 0);
      const existing = docItems.find(i => i.id === id);
      if (existing) { existing.qty += qty; }
      else docItems.push({ id, nome: prod["Nome do Produto"] || "—", img: prod["Imagem 1 (URL)"] || "", preco, qty });
      renderDocItems();
      updateDocTotal();
      sel.value = "";
      document.getElementById("docProdQty").value = 1;
    }

    function changeDocQty(idx, delta) {
      docItems[idx].qty = Math.max(1, docItems[idx].qty + delta);
      renderDocItems();
      updateDocTotal();
    }

    function removeDocItem(idx) {
      docItems.splice(idx, 1);
      renderDocItems();
      updateDocTotal();
    }

    function renderDocItems() {
      const el = document.getElementById("docItemsList");
      if (!docItems.length) {
        el.innerHTML = `<div style="color:var(--muted);font-size:13px;text-align:center;padding:10px 0">Nenhum produto adicionado</div>`;
        return;
      }
      el.innerHTML = docItems.map((it, i) => `
    <div class="doc-item-row">
      ${it.img ? `<img class="doc-item-thumb" src="${it.img}" onerror="this.style.display='none'">` : `<div class="doc-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:18px">📦</div>`}
      <div class="doc-item-info">
        <div class="doc-item-nm">${it.nome}</div>
        <div class="doc-item-pr">${fmt(it.preco * it.qty)}</div>
      </div>
      <div class="doc-qty-ctrl">
        <button class="dqb" onclick="changeDocQty(${i},-1)">−</button>
        <span style="min-width:24px;text-align:center;font-size:13px;font-weight:700">${it.qty}</span>
        <button class="dqb" onclick="changeDocQty(${i},1)">+</button>
      </div>
      <button onclick="removeDocItem(${i})" style="background:rgba(244,67,54,.12);border:none;color:var(--r);border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:13px">✕</button>
    </div>`).join("");
    }

    function updateDocTotal() {
      const total = docItems.reduce((s, it) => s + it.preco * it.qty, 0);
      document.getElementById("docTotalVal").textContent = fmt(total);
    }

    function buildDocHtml(tipo) {
      const nome = document.getElementById("docNome").value.trim() || "—";
      const tel = document.getElementById("docTel").value.trim() || "";
      const end = document.getElementById("docEnd").value.trim() || "";
      const obs = document.getElementById("docObs").value.trim() || "";
      const validade = document.getElementById("docValidade").value.trim() || "7 dias";
      const garantia = document.getElementById("docGarantia").value.trim() || cfg.TERMO_GARANTIA_GLOBAL || "";
      const total = docItems.reduce((s, it) => s + it.preco * it.qty, 0);
      const titulo = tipo === "orcamento" ? "ORÇAMENTO" : "RECIBO DE VENDA";
      const num = tipo === "orcamento" ? "ORC" : "REC";
      const docId = num + Date.now().toString().slice(-6);
      const data = new Date().toLocaleDateString("pt-BR");

      const itensRows = docItems.map(it => `
    <tr>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;font-size:13px">${it.nome}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:13px">${it.qty}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px">R$ ${it.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
      <td style="padding:9px 10px;border-bottom:1px solid #f0f0f0;text-align:right;font-size:13px;font-weight:700">R$ ${(it.preco * it.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
    </tr>`).join("");

      return `<div style="max-width:680px;margin:0 auto;font-family:Arial,sans-serif;color:#000;padding:24px">
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;border-bottom:3px solid #00e676;padding-bottom:16px">
    <div>
      <div style="font-size:30px;font-weight:900;letter-spacing:-1px;color:#000">GJ STORE</div>
      <div style="font-size:12px;color:#555;margin-top:4px">WhatsApp: (21) 97036-3062</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:900;text-transform:uppercase;color:#000">${titulo}</div>
      <div style="font-size:12px;color:#555;margin-top:3px">Nº ${docId}</div>
      <div style="font-size:12px;color:#555">Data: ${data}</div>
      ${tipo === "orcamento" ? `<div style="font-size:12px;color:#555">Válido por: ${validade}</div>` : ""}
    </div>
  </div>

  <div style="background:#f8f8f8;border-radius:10px;padding:14px;margin-bottom:16px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:6px">CLIENTE</div>
    <div style="font-size:14px;font-weight:700">${nome}</div>
    ${tel ? `<div style="font-size:12px;color:#555;margin-top:2px">📱 ${tel}</div>` : ""}
    ${end ? `<div style="font-size:12px;color:#555;margin-top:2px">📍 ${end}</div>` : ""}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #eee">
    <thead><tr style="background:#00e676">
      <th style="padding:10px;text-align:left;font-size:12px;color:#000">Produto</th>
      <th style="padding:10px;text-align:center;font-size:12px;color:#000">Qtd</th>
      <th style="padding:10px;text-align:right;font-size:12px;color:#000">Unit.</th>
      <th style="padding:10px;text-align:right;font-size:12px;color:#000">Total</th>
    </tr></thead>
    <tbody>${itensRows}</tbody>
  </table>

  <div style="text-align:right;margin-bottom:16px">
    <div style="display:inline-block;background:#00e676;border-radius:10px;padding:12px 20px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#04090f">TOTAL</div>
      <div style="font-size:24px;font-weight:900;color:#04090f">R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
      <div style="font-size:12px;color:#04090f;margin-top:2px">Pagamento: ${docPagSel}</div>
    </div>
  </div>

  ${(garantia || obs) ? `<div style="border:1px dashed #ccc;border-radius:8px;padding:12px;font-size:12px;color:#555;margin-bottom:12px">
    ${garantia ? `<div><strong>Garantia:</strong> ${garantia}</div>` : ""}
    ${obs ? `<div style="margin-top:${garantia ? 6 : 0}px"><strong>Obs:</strong> ${obs}</div>` : ""}
  </div>`: ""}

  <div style="text-align:center;margin-top:20px;font-size:11px;color:#aaa;border-top:1px solid #eee;padding-top:14px">
    Obrigado pela preferência! 💚 — GJ Store
  </div>
</div>`;
    }

    function docPrintA4() {
      if (!docItems.length) { toast("Adicione pelo menos um produto", "err"); return; }
      document.getElementById("printArea").innerHTML = buildDocHtml(docType);
      window.print();
    }

    async function docPdf() {
      if (!docItems.length) { toast("Adicione pelo menos um item", "err"); return; }
      const div = document.createElement("div");
      div.style.cssText = "position:absolute;top:0;left:0;width:720px;background:#fff;z-index:-9999;opacity:1;display:block;padding:20px;box-sizing:border-box;";
      div.innerHTML = buildDocHtml(docType);
      document.body.appendChild(div);
      try {
        if (!window.html2canvas) {
          await loadScript("https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js");
        }
        const canvas = await window.html2canvas(div, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
        if (document.body.contains(div)) document.body.removeChild(div);
        const nome = document.getElementById("docNome").value.trim() || "documento";
        const link = document.createElement("a");
        link.download = `${docType}_${nome.replace(/\s+/g, "_")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast("Imagem baixada ✅");
      } catch (e) {
        if (document.body.contains(div)) document.body.removeChild(div);
        toast("Erro ao gerar imagem", "err"); console.error(e);
      }
    }

    function docWhatsApp() {
      if (!docItems.length) { toast("Adicione pelo menos um produto", "err"); return; }
      const tel = document.getElementById("docTel").value.trim().replace(/\D/g, "");
      const nome = document.getElementById("docNome").value.trim() || "";
      const total = docItems.reduce((s, it) => s + it.preco * it.qty, 0);
      const itensText = docItems.map(it => `• ${it.nome} x${it.qty} = R$ ${(it.preco * it.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n");
      const titulo = docType === "orcamento" ? "📋 *ORÇAMENTO GJ STORE*" : "🧾 *RECIBO GJ STORE*";
      const msg = encodeURIComponent(`${titulo}\n\n👤 ${nome}\n💳 ${docPagSel}\n\n${itensText}\n\n💰 *Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\nObrigado pela preferência! 💚`);
      const base = tel ? `https://wa.me/55${tel}?text=${msg}` : `https://wa.me/?text=${msg}`;
      window.open(base, "_blank");
    }

    function docWhatsAppContact() {
      if (!docItems.length) { toast("Adicione pelo menos um produto", "err"); return; }
      const sel = document.querySelector(".contact-chip.sel");
      const tel = sel ? sel.dataset.tel : (document.getElementById("docTel").value.trim().replace(/\D/g, ""));
      const nome = document.getElementById("docNome").value.trim() || "";
      const total = docItems.reduce((s, it) => s + it.preco * it.qty, 0);
      const itensText = docItems.map(it => `• ${it.nome} x${it.qty} = R$ ${(it.preco * it.qty).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`).join("\n");
      const titulo = docType === "orcamento" ? "📋 *ORÇAMENTO GJ STORE*" : "🧾 *RECIBO GJ STORE*";
      const msg = encodeURIComponent(`${titulo}\n\n👤 ${nome}\n💳 ${docPagSel}\n\n${itensText}\n\n💰 *Total: R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}*\n\nObrigado pela preferência! 💚`);
      const base = tel ? `https://wa.me/55${tel}?text=${msg}` : `https://wa.me/?text=${msg}`;
      window.open(base, "_blank");
    }

    // ═══════════════════════════════════════════════
    // THEME ENGINE
    let _temasAtivos = ["cyberpunk", "light", "gold"];

    function initTheme() {
      let t = localStorage.getItem("gj_theme") || "cyberpunk";
      if (t === "botafogo") { t = "gold"; localStorage.setItem("gj_theme", t); }
      applyTheme(t, true);
    }
    function applyTheme(t, silent) {
      document.documentElement.className = t === "cyberpunk" ? "" : "theme-" + t;
      localStorage.setItem("gj_theme", t);
      const sel = document.getElementById("themeSel");
      if (sel) sel.value = t;
      const nomes = { cyberpunk:"Cyberpunk Dark", light:"Minimalist Light", gold:"Gold Premium" };
      if (!silent) toast("Tema: " + (nomes[t] || t));
    }

    async function loadTemas() {
      try {
        const r = await apiGet("getTemas");
        const temas = r.temas || [];
        if (!temas.length) return;
        _temasAtivos = temas
          .filter(t => (t["Status"] || "Ativo").toLowerCase() === "ativo")
          .map(t => (t["Tema_ID"] || t["id"] || "").replace("botafogo", "gold"))
          .filter(Boolean);
        if (!_temasAtivos.length) _temasAtivos = ["cyberpunk", "light", "gold"];
        const sel = document.getElementById("themeSel");
        if (!sel) return;
        const opts = [
          { id:"cyberpunk", lbl:"🌑 Cyberpunk" },
          { id:"light", lbl:"☀️ Light" },
          { id:"gold", lbl:"⭐ Gold" }
        ];
        sel.innerHTML = opts.filter(o => _temasAtivos.includes(o.id))
          .map(o => `<option value="${o.id}">${o.lbl}</option>`).join("");
        let cur = localStorage.getItem("gj_theme") || "cyberpunk";
        if (cur === "botafogo") cur = "gold";
        sel.value = _temasAtivos.includes(cur) ? cur : (_temasAtivos[0] || "cyberpunk");
      } catch(e) { /* keep defaults */ }
    }

    // ═══════════════════════════════════════════════
    // CATEGORIAS DINÂMICAS
    const DEFAULT_CATS = [
      { ID:"CAT1", Nome:"Eletrônicos", Emoji:"📱", Cor_Hex:"#00bcd4", Status:"Ativo" },
      { ID:"CAT2", Nome:"iPhones Lacrados", Emoji:"📦", Cor_Hex:"#00e676", Status:"Ativo" },
      { ID:"CAT3", Nome:"iPhone", Emoji:"📱", Cor_Hex:"#00e676", Status:"Ativo" },
      { ID:"CAT4", Nome:"iPhones Seminovos", Emoji:"🔄", Cor_Hex:"#00bcd4", Status:"Ativo" },
      { ID:"CAT5", Nome:"Notebooks", Emoji:"💻", Cor_Hex:"#7c4dff", Status:"Ativo" },
      { ID:"CAT6", Nome:"Games", Emoji:"🎮", Cor_Hex:"#ff6d00", Status:"Ativo" },
      { ID:"CAT7", Nome:"Fones de Ouvido", Emoji:"🎧", Cor_Hex:"#00bcd4", Status:"Ativo" },
      { ID:"CAT8", Nome:"Casa", Emoji:"🏠", Cor_Hex:"#26a69a", Status:"Ativo" },
      { ID:"CAT9", Nome:"Segurança", Emoji:"📷", Cor_Hex:"#f44336", Status:"Ativo" },
      { ID:"CAT10", Nome:"Informática", Emoji:"🖥️", Cor_Hex:"#5c6bc0", Status:"Ativo" },
      { ID:"CAT11", Nome:"Cabos e Carregadores", Emoji:"🔌", Cor_Hex:"#ff6d00", Status:"Ativo" },
      { ID:"CAT12", Nome:"Outros", Emoji:"📦", Cor_Hex:"#78909c", Status:"Ativo" }
    ];
    let allCats = [];

    function getCatsFromStorage() {
      try {
        const s = localStorage.getItem("gj_cats");
        return s ? JSON.parse(s) : null;
      } catch(e) { return null; }
    }
    function saveCatsToStorage(cats) {
      try { localStorage.setItem("gj_cats", JSON.stringify(cats)); } catch(e) {}
    }

    async function loadCategorias() {
      try {
        const r = await apiGet("getCategorias");
        allCats = (r.categorias || []).filter(c => c.Status !== "Inativo");
        if (!allCats.length) throw new Error("vazio");
        saveCatsToStorage(allCats);
      } catch(e) {
        const cached = getCatsFromStorage();
        allCats = cached || DEFAULT_CATS;
        saveCatsToStorage(allCats);
      }
      populateCatSelects();
      renderCatPage();
    }

    function populateCatSelects() {
      const ativo = allCats.filter(c => c.Status !== "Inativo");
      const opts = ativo.map(c => `<option value="${c.Nome}">${c.Emoji || ""} ${c.Nome}</option>`).join("");
      ["fcat"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = `<option value="">Selecione</option>` + opts;
      });
      const pcat = document.getElementById("pcat");
      if (pcat) pcat.innerHTML = `<option value="">Todas categorias</option>` + opts;
    }

    function renderCatPage() {
      const el = document.getElementById("catList");
      if (!el) return;
      if (!allCats.length) { el.innerHTML = `<div class="empty">Nenhuma categoria ainda.</div>`; return; }
      el.innerHTML = allCats.map(c => `
        <div class="cat-card">
          <div class="cat-ico-preview" style="background:${c.Cor_Hex || "#333"}22;color:${c.Cor_Hex || "var(--g)"}">
            ${c.Emoji || "📦"}
          </div>
          <div class="cat-info">
            <div class="cat-name">${c.Nome}</div>
            <div class="cat-status">${c.Status || "Ativo"}</div>
          </div>
          <div class="cat-actions">
            <button class="cat-btn cat-edit-btn" data-cat-id="${c.ID}">✏️</button>
            <button class="cat-btn cat-del-btn" data-cat-id="${c.ID}">🗑️</button>
          </div>
        </div>`).join("");
    }

    function openCatForm(c) {
      document.getElementById("catFormWrap").style.display = "block";
      document.getElementById("catEditId").value = c ? c.ID : "";
      document.getElementById("catNome").value = c ? c.Nome : "";
      document.getElementById("catEmoji").value = c ? (c.Emoji || "") : "";
      document.getElementById("catCor").value = c ? (c.Cor_Hex || "#00e676") : "#00e676";
      document.getElementById("catStatus").value = c ? (c.Status || "Ativo") : "Ativo";
      document.getElementById("catNome").focus();
    }
    function closeCatForm() { document.getElementById("catFormWrap").style.display = "none"; }
    function editCat(c) { openCatForm(c); }

    async function salvarCat() {
      const nome = document.getElementById("catNome").value.trim();
      if (!nome) { toast("Informe o nome", "err"); return; }
      const id = document.getElementById("catEditId").value || ("CAT" + Date.now());
      const cat = {
        ID: id, Nome: nome,
        Emoji: document.getElementById("catEmoji").value.trim() || "📦",
        Cor_Hex: document.getElementById("catCor").value,
        Status: document.getElementById("catStatus").value
      };
      const idx = allCats.findIndex(c => c.ID === id);
      if (idx >= 0) allCats[idx] = cat; else allCats.push(cat);
      saveCatsToStorage(allCats);
      populateCatSelects();
      renderCatPage();
      closeCatForm();
      toast("Categoria salva ✅");
      try {
        await apiGet("salvarCategoria", { id: cat.ID, nome: cat.Nome, emoji: cat.Emoji, cor: cat.Cor_Hex, status: cat.Status });
      } catch(e) {}
    }

    async function deleteCat(id, nome) {
      if (!confirm(`Excluir categoria "${nome}"?`)) return;
      allCats = allCats.filter(c => c.ID !== id);
      saveCatsToStorage(allCats);
      populateCatSelects();
      renderCatPage();
      toast("Categoria removida");
      try { await apiGet("deletarCategoria", { id }); } catch(e) {}
    }

    // ═══════════════════════════════════════════════
    // SCORE DE CLIENTES
    // Cache de baixas para cálculo de score inline
    let _baixasCache = [];
    function scoreFromBaixas(nomeCliente) {
      if (!nomeCliente || !_baixasCache.length) return "";
      const key = nomeCliente.toLowerCase().trim();
      const items = _baixasCache.filter(b => (b["Nome_Cliente"] || "").toLowerCase().trim() === key);
      if (!items.length) return "";
      return scoreBadge(calcScore(items));
    }

    function calcScore(baixas) {
      let score = 1000;
      baixas.forEach(b => {
        const status = String(b["Status_Pagamento"] || "");
        const dias = Number(b["Dias_Atraso"] || 0);
        if (status === "Antecipado") score += 30;
        else if (status === "No Prazo" || status === "Em Dia") score += 10;
        else if (status.startsWith("Atrasado") && dias > 0) score -= Math.min(dias * 15, 600);
        if (status === "Cancelado") score = 0;
      });
      return Math.max(0, Math.min(1000, score));
    }

    function scoreBadge(score) {
      if (score >= 900) return `<span class="score-badge score-ex">🟢 ${score} Excelente</span>`;
      if (score >= 600) return `<span class="score-badge score-reg">🟡 ${score} Regular</span>`;
      return `<span class="score-badge score-risk">🔴 ${score} Risco</span>`;
    }

    let _scoreCache = [];

    async function loadScore() {
      const el = document.getElementById("scoreList");
      if (!el) return;
      try {
        const r = await apiGet("getFinanceiro");
        const normNome = n => (n || "").toLowerCase().trim().replace(/\s+/g, " ");
        const baixas = r.baixas || [];
        const map = {};
        baixas.forEach(b => {
          const key = normNome(b["Nome_Cliente"] || b["Nome Cliente"] || "");
          if (!key) return;
          if (!map[key]) map[key] = { nome: b["Nome_Cliente"] || b["Nome Cliente"] || key, items: [], tel: "", end: "", lastPedido: null };
          // Ignora linhas "Liquidado" (saldo anterior já quitado) para não contar duplicado
          if (String(b["Status_Pagamento"] || "") !== "Liquidado") map[key].items.push(b);
          if (!map[key].tel && b["Telefone"]) map[key].tel = b["Telefone"];
        });
        if (allPeds.length) {
          allPeds.forEach(p => {
            const key = normNome(p["Nome Cliente"] || "");
            if (map[key]) {
              if (!map[key].tel) map[key].tel = p["Telefone"] || "";
              if (!map[key].end) map[key].end = p["Endereço"] || p["Endereço de Entrega"] || "";
              map[key].lastPedido = p;
            }
          });
        }
        _scoreCache = Object.values(map).sort((a, b) => calcScore(b.items) - calcScore(a.items));
        renderScoreList(_scoreCache);
      } catch(e) { el.innerHTML = `<div class="empty">Erro ao carregar score.</div>`; }
    }

    function renderScoreList(clientes) {
      const el = document.getElementById("scoreList");
      if (!el) return;
      if (!clientes.length) { el.innerHTML = `<div class="empty">Nenhum histórico ainda.</div>`; return; }
      el.innerHTML = clientes.map(c => {
        const sc = calcScore(c.items);
        const alerta = sc < 600 ? `<div style="font-size:11px;color:var(--r);margin-top:4px">⛔ Bloquear venda a prazo</div>` :
          sc < 900 ? `<div style="font-size:11px;color:#ffd600;margin-top:4px">⚠️ Atrasos esporádicos</div>` : "";
        const cJson = JSON.stringify(c).replace(/'/g,"&apos;").replace(/"/g,"&quot;");
        return `<div class="cat-card" style="flex-direction:column;align-items:flex-start;cursor:pointer" onclick='openScoreModal(JSON.parse(decodeURIComponent(this.dataset.c)))' data-c="${encodeURIComponent(JSON.stringify(c))}">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:8px">
            <span style="font-family:var(--H);font-size:14px;font-weight:700">${c.nome}</span>
            ${scoreBadge(sc)}
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${c.items.length} transação(ões) ${c.tel ? "· " + c.tel : ""}</div>
          ${alerta}
        </div>`;
      }).join("");
    }

    function filterScoreList(q) {
      if (!_scoreCache.length) return;
      const filtered = q.trim() ? _scoreCache.filter(c =>
        c.nome.toLowerCase().includes(q.toLowerCase()) || (c.tel || "").includes(q)
      ) : _scoreCache;
      renderScoreList(filtered);
    }

    function openScoreModal(c) {
      const sc = calcScore(c.items);
      const totalGasto = c.items.reduce((s, b) => s + Number(b["Valor_Final_Recebido"] || 0), 0);
      const antec = c.items.filter(b => b["Status_Pagamento"] === "Antecipado").length;
      const prazo = c.items.filter(b => b["Status_Pagamento"] === "No Prazo" || b["Status_Pagamento"] === "Em Dia").length;
      const atras = c.items.filter(b => String(b["Status_Pagamento"]).startsWith("Atrasado")).length;
      const pontual = c.items.length ? Math.round((antec + prazo) / c.items.length * 100) : 0;
      const last = c.items[c.items.length - 1];
      const lastDate = last ? (last["Data_Baixa_Efetiva"] || "—") : "—";
      const lastVal = last ? fmt(last["Valor_Final_Recebido"]) : "—";
      const end = c.lastPedido ? (c.lastPedido["Endereço"] || c.lastPedido["Endereço de Entrega"] || "—") : "—";
      document.getElementById("scoreModalName").textContent = c.nome;
      document.getElementById("scoreModalBadge").innerHTML = scoreBadge(sc);
      document.getElementById("scoreModalContent").innerHTML = `
        ${c.tel ? `<div style="font-size:12px;color:var(--muted);margin-bottom:4px">📱 ${c.tel}</div>` : ""}
        ${end !== "—" ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px">📍 ${end}</div>` : ""}
        <div class="score-stat-grid">
          <div class="score-stat"><div class="score-stat-v" style="color:var(--g)">${fmt(totalGasto)}</div><div class="score-stat-l">Total Gasto</div></div>
          <div class="score-stat"><div class="score-stat-v">${c.items.length}</div><div class="score-stat-l">Transações</div></div>
          <div class="score-stat"><div class="score-stat-v" style="color:${pontual>=80?"var(--g)":pontual>=50?"#ffd600":"var(--r)"}">${pontual}%</div><div class="score-stat-l">Pontualidade</div></div>
        </div>
        <div style="background:var(--d3);border-radius:10px;padding:10px;font-size:12px;margin-bottom:10px">
          <div style="margin-bottom:6px;font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase">Histórico de Pagamentos</div>
          <div style="color:var(--g)">🟢 Antecipado: ${antec}×</div>
          <div style="color:var(--c)">🔵 No Prazo: ${prazo}×</div>
          <div style="color:var(--r)">🔴 Com Atraso: ${atras}×</div>
        </div>
        <div style="background:var(--d3);border-radius:10px;padding:10px;font-size:12px">
          <div style="font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;margin-bottom:4px">Última Compra</div>
          <div>📅 ${lastDate}</div>
          <div style="color:var(--g);font-weight:700;margin-top:2px">${lastVal}</div>
        </div>`;
      document.getElementById("scoreModal").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function closeScoreModal(e) {
      if (!e || e.target === document.getElementById("scoreModal")) {
        document.getElementById("scoreModal").classList.add("hidden");
        document.body.style.overflow = "";
      }
    }

    // ═══════════════════════════════════════════════
    // CONTACT MANAGER (AGENDA WPP)
    const MEU_NUMERO = "21970363062";
    function getContacts() {
      try { return JSON.parse(localStorage.getItem("gj_contacts") || "[]"); } catch(e) { return []; }
    }
    function saveContacts(arr) {
      try { localStorage.setItem("gj_contacts", JSON.stringify(arr.slice(0, 8))); } catch(e) {}
    }
    function renderContactChips() {
      const chips = document.getElementById("contactChips");
      if (!chips) return;
      const contacts = [{ tel: MEU_NUMERO, label: "Meu número 📱" }, ...getContacts()];
      chips.innerHTML = contacts.map((c, i) =>
        `<div class="contact-chip${i === 0 ? " sel" : ""}" data-tel="${c.tel}" onclick="selContact(this)">${c.label || c.tel}</div>`
      ).join("");
    }
    function selContact(el) {
      document.querySelectorAll(".contact-chip").forEach(c => c.classList.remove("sel"));
      el.classList.add("sel");
    }
    function addContact() {
      const inp = document.getElementById("newContactInput");
      const tel = inp.value.trim().replace(/\D/g, "");
      if (!tel || tel.length < 8) { toast("Número inválido", "err"); return; }
      const contacts = getContacts();
      if (!contacts.find(c => c.tel === tel)) {
        contacts.unshift({ tel, label: tel });
        saveContacts(contacts);
      }
      inp.value = "";
      renderContactChips();
      toast("Contato salvo ✅");
    }

    // ═══════════════════════════════════════════════
    // SWIPE TO CLOSE MODAL
    let msy = 0;
    document.getElementById("mmodal").addEventListener("touchstart", e => { msy = e.touches[0].clientY; }, { passive: true });
    document.getElementById("mmodal").addEventListener("touchend", e => {
      if (e.changedTouches[0].clientY - msy > 80 && document.getElementById("mmodal").scrollTop === 0) closeM();
    });

    // ═══════════════════════════════════════════════════════════════
    // EVENT DELEGATION — elimina handlers inline e bug de aspas
    // ═══════════════════════════════════════════════════════════════

    // Lista de produtos
    document.getElementById("plist").addEventListener("click", e => {
      const editBtn = e.target.closest(".ae");
      const delBtn = e.target.closest(".ad");
      if (editBtn) {
        const prod = allProds.find(p => p["ID"] === editBtn.dataset.prodId);
        if (prod) editProd(prod);
      } else if (delBtn) {
        const prod = allProds.find(p => p["ID"] === delBtn.dataset.delId);
        if (prod) delProd(prod["ID"], prod["Nome do Produto"] || "");
      }
    });

    // Kanban cards
    document.querySelector(".kanban").addEventListener("click", e => {
      const infoBtn = e.target.closest(".kb-info");
      const nextBtn = e.target.closest(".kb-next");
      const wppBtn = e.target.closest(".kb-wpp");
      const canBtn = e.target.closest(".kb-can");
      const revBtn = e.target.closest(".kb-rev");
      const actionBtn = infoBtn || nextBtn || wppBtn || canBtn || revBtn;
      if (actionBtn) {
        e.stopPropagation();
        const id = actionBtn.dataset.pedId;
        const ped = allPeds.find(p => p["ID Pedido"] === id);
        if (infoBtn && ped) { openDetail(ped); return; }
        if (nextBtn) { moverPed(id, nextBtn.dataset.next); return; }
        if (wppBtn && ped) { wppPed(ped["Telefone"] || "", ped["Nome Cliente"] || ""); return; }
        if (canBtn) { moverPed(id, "Cancelado"); return; }
        if (revBtn) { moverPed(id, revBtn.dataset.next || "Pendente"); return; }
        return;
      }
      const card = e.target.closest(".kcard");
      if (card) {
        const id = card.dataset.id;
        const ped = allPeds.find(p => p["ID Pedido"] === id);
        if (ped) openDetail(ped);
      }
    });

    // Cards recentes no dashboard
    document.getElementById("drecentes").addEventListener("click", e => {
      const card = e.target.closest(".rcard");
      if (!card) return;
      const id = card.dataset.pedId;
      const ped = allPeds.find(p => p["ID Pedido"] === id);
      if (ped) openDetail(ped);
    });

    // Ações do detalhe do pedido
    document.getElementById("detActions").addEventListener("click", e => {
      const btn = e.target.closest("button");
      if (!btn || !currentDetailPed) return;
      const p = currentDetailPed;
      const id = p["ID Pedido"] || "";
      const move = btn.dataset.detMove;
      const action = btn.dataset.detAction;
      if (move) { detMove(id, move); return; }
      if (action === "printA4") { printA4(); return; }
      if (action === "printTermica") { printTermica(); return; }
      if (action === "uploadDriveWpp") { uploadDriveWpp(id, p["Telefone"] || "", p["Nome Cliente"] || ""); return; }
      if (action === "wppPed") { wppPed(p["Telefone"] || "", p["Nome Cliente"] || ""); return; }
    });

    // Busca de produtos no Novo Pedido
    document.getElementById("npSearchResults").addEventListener("click", e => {
      const item = e.target.closest(".np-res-item");
      if (!item) return;
      const prod = allProds.find(p => String(p["ID"]) === item.dataset.prodId);
      if (prod) npAddProd(prod);
    });

    // Itens do Novo Pedido (qty + remove)
    document.getElementById("npItemsList").addEventListener("click", e => {
      const delBtn = e.target.closest(".np-item-del");
      if (delBtn) removeNpItem(Number(delBtn.dataset.idx));
    });
    document.getElementById("npItemsList").addEventListener("input", e => {
      const qtyInp = e.target.closest(".np-item-qty");
      if (qtyInp) npSetQty(Number(qtyInp.dataset.idx), qtyInp.value);
    });

    // Botões CRM — abrir WhatsApp
    document.getElementById("dcrm").addEventListener("click", e => {
      const wppBtn = e.target.closest(".crm-wpp");
      if (wppBtn && wppBtn.dataset.wppUrl) { window.open(decodeURIComponent(wppBtn.dataset.wppUrl), "_blank"); return; }
      const cupomBtn = e.target.closest(".crm-cupom-btn");
      if (cupomBtn) crmCriarCupom(cupomBtn.dataset.tel, cupomBtn.dataset.nome);
    });

    // Botões de Categorias
    document.getElementById("page-cat").addEventListener("click", e => {
      const editBtn = e.target.closest(".cat-edit-btn");
      const delBtn = e.target.closest(".cat-del-btn");
      if (editBtn) {
        const cat = (typeof allCats !== "undefined" ? allCats : []).find(c => c.ID === editBtn.dataset.catId);
        if (cat) openCatForm(cat);
      } else if (delBtn) {
        const cat = (typeof allCats !== "undefined" ? allCats : []).find(c => c.ID === delBtn.dataset.catId);
        if (cat) deleteCat(cat.ID, cat.Nome || "");
      }
    });

    // ═══════════════════════════════════════════════════════════════
    // CONFIG DINÂMICA — aplica CSS vars e nome da loja da planilha
    // ═══════════════════════════════════════════════════════════════
    async function loadAndApplyConfig() {
      try {
        const r = await apiGet("getConfig");
        const cfg = r.config || {};
        const root = document.documentElement;
        if (cfg.COR_PRIMARIA_HEX) root.style.setProperty("--g", cfg.COR_PRIMARIA_HEX);
        if (cfg.COR_SECUNDARIA_HEX) root.style.setProperty("--c", cfg.COR_SECUNDARIA_HEX);
        if (cfg.COR_FUNDO_HEX) root.style.setProperty("--dark", cfg.COR_FUNDO_HEX);
        if (cfg.COR_TEXTO_HEX) root.style.setProperty("--text", cfg.COR_TEXTO_HEX);
        if (cfg.NOME_LOJA) {
          document.title = cfg.NOME_LOJA + " Admin";
          document.querySelectorAll(".gj-loja-nome").forEach(el => { el.textContent = cfg.NOME_LOJA; });
        }
        return cfg;
      } catch(e) { }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYTICS — aba de métricas com Chart.js
    // ═══════════════════════════════════════════════════════════════
    let analyticsCharts = {};
    let analyticsFilter = "30";

    async function loadAnalytics(periodo) {
      analyticsFilter = periodo || analyticsFilter;
      document.querySelectorAll(".an-filter-btn").forEach(b => b.classList.toggle("on", b.dataset.p === analyticsFilter));
      const el = document.getElementById("analyticsContent");
      el.innerHTML = `<div class="loading"><div class="spin"></div>Carregando métricas...</div>`;
      try {
        const metricsP = apiGet("getMetricas", { dias: analyticsFilter });
        const pedsP = allPeds.length ? Promise.resolve({ pedidos: allPeds }) : apiGet("getPedidos");
        const [r, pp] = await Promise.all([metricsP, pedsP]);
        if (pp.pedidos) allPeds = pp.pedidos;
        if (!allProds.length) {
          const pr = await apiGet("getProdutos").catch(() => ({ produtos: [] }));
          allProds = pr.produtos || [];
        }
        if (r.error) {
          el.innerHTML = `<div class="empty" style="color:var(--r)">❌ Erro ao carregar métricas: ${r.error}<br><small style="color:var(--muted)">Verifique se o Apps Script foi reimplantado após a última atualização.</small></div>`;
          return;
        }
        renderAnalyticsDash(r.metricas || {}, allPeds);
      } catch(e) {
        el.innerHTML = `<div class="empty">Erro ao carregar métricas. Verifique se o Apps Script foi atualizado.</div>`;
      }
    }

    function renderAnalyticsDash(m, peds) {
      const el = document.getElementById("analyticsContent");
      const conv = m.totalCheckouts > 0 ? ((m.totalPedidos / m.totalCheckouts) * 100).toFixed(1) : "0.0";
      const abandono = m.totalCarrinhos > 0 ? (((m.totalCarrinhos - m.totalCheckouts) / m.totalCarrinhos) * 100).toFixed(1) : "0.0";
      const semDados = !m.totalAcessos && !m.totalProdutosVistos && !m.totalCarrinhos;

      el.innerHTML = `
        ${semDados ? `<div style="padding:12px 14px;background:rgba(0,188,212,.08);border-left:3px solid var(--c);border-radius:0 10px 10px 0;margin-bottom:14px;font-size:13px;color:var(--c)">ℹ️ Ainda sem dados de acessos. Os dados são coletados automaticamente quando clientes visitam a loja.</div>` : ""}
        <div style="font-family:var(--H);font-weight:800;font-size:14px;margin-bottom:8px">🌐 Métricas da Loja</div>
        <div class="an-cards">
          <div class="an-card"><div class="an-card-v" style="color:var(--g)">${m.totalAcessos || 0}</div><div class="an-card-l">Acessos</div></div>
          <div class="an-card"><div class="an-card-v" style="color:var(--c)">${m.totalProdutosVistos || 0}</div><div class="an-card-l">Vistos</div></div>
          <div class="an-card"><div class="an-card-v" style="color:var(--o)">${m.totalCarrinhos || 0}</div><div class="an-card-l">Carrinhos</div></div>
          <div class="an-card"><div class="an-card-v" style="color:var(--g)">${m.totalPedidos || 0}</div><div class="an-card-l">Pedidos</div></div>
          <div class="an-card"><div class="an-card-v" style="color:${Number(conv) >= 10 ? "var(--g)" : "var(--o)"}">${conv}%</div><div class="an-card-l">Conversão</div></div>
          <div class="an-card"><div class="an-card-v" style="color:${Number(abandono) <= 40 ? "var(--g)" : "var(--r)"}">${abandono}%</div><div class="an-card-l">Abandono</div></div>
        </div>
        <div class="chart-wrap" style="margin-top:12px">
          <div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:10px">📈 Acessos por Dia</div>
          <canvas id="anLineChart" height="200"></canvas>
        </div>
        <div class="chart-wrap" style="margin-top:12px">
          <div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:10px">🏆 Top 10 Produtos Mais Vistos</div>
          <canvas id="anBarChart" height="250"></canvas>
        </div>
        <div class="chart-wrap" style="margin-top:12px">
          <div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:10px">🕒 Acessos por Hora do Dia</div>
          <canvas id="anHeatChart" height="180"></canvas>
        </div>
        <div style="height:1px;background:var(--border);margin:20px 0"></div>
        <div style="font-family:var(--H);font-weight:800;font-size:14px;margin-bottom:12px">💰 Financeiro (Pedidos)</div>
        <div class="chart-wrap" id="chartWrap">
          <div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <span style="width:3px;height:13px;background:linear-gradient(var(--g),var(--c));border-radius:2px;display:block"></span>Faturamento & Lucro (6 meses)
          </div>
          <canvas id="dashChart" height="200"></canvas>
          <div class="chart-toggles">
            <button class="cht-btn" style="color:var(--g);border-color:var(--g)" id="cht-fat" onclick="toggleDataset(0)">Faturamento</button>
            <button class="cht-btn" style="color:var(--c);border-color:var(--c)" id="cht-luc" onclick="toggleDataset(1)">Lucro</button>
            <button class="cht-btn off" style="color:var(--r);border-color:var(--r)" id="cht-cus" onclick="toggleDataset(2)">Custo</button>
          </div>
        </div>
        <div class="chart-wrap" id="payChartWrap" style="margin-top:8px">
          <div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <span style="width:3px;height:13px;background:linear-gradient(var(--o),var(--c));border-radius:2px;display:block"></span>Formas de Pagamento
          </div>
          <canvas id="payChart" height="180"></canvas>
        </div>
        <div id="anOperadores" style="margin-top:14px"></div>`;

      // Destroi charts comportamentais antigos
      Object.values(analyticsCharts).forEach(c => { try { c.destroy(); } catch(e) {} });
      analyticsCharts = {};

      // Acessos por dia
      if (m.acessosPorDia && m.acessosPorDia.length) {
        const ctx = document.getElementById("anLineChart").getContext("2d");
        analyticsCharts.line = new Chart(ctx, {
          type: "line",
          data: {
            labels: m.acessosPorDia.map(d => d.data),
            datasets: [{ label: "Acessos", data: m.acessosPorDia.map(d => d.total),
              borderColor: "#00e676", backgroundColor: "rgba(0,230,118,.12)", tension: 0.4, fill: true, pointRadius: 3 }]
          },
          options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#667" } }, y: { ticks: { color: "#667" }, beginAtZero: true } } }
        });
      }

      // Top produtos vistos — resolve nomes reais pelo ID
      if (m.topProdutos && m.topProdutos.length) {
        const prodIdx = {};
        allProds.forEach(p => { if (p["ID"]) prodIdx[String(p["ID"])] = p["Nome do Produto"] || p["ID"]; });
        const ctx = document.getElementById("anBarChart").getContext("2d");
        analyticsCharts.bar = new Chart(ctx, {
          type: "bar",
          data: {
            labels: m.topProdutos.map(p => (prodIdx[String(p.id)] || p.nome || p.id || "?").substring(0, 22)),
            datasets: [{ label: "Visualizações", data: m.topProdutos.map(p => p.total),
              backgroundColor: "rgba(0,188,212,.7)", borderRadius: 6 }]
          },
          options: { indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#667" }, beginAtZero: true }, y: { ticks: { color: "#aaa", font: { size: 11 } } } } }
        });
      }

      // Acessos por hora
      if (m.acessosPorHora && m.acessosPorHora.length) {
        const ctx = document.getElementById("anHeatChart").getContext("2d");
        analyticsCharts.heat = new Chart(ctx, {
          type: "bar",
          data: {
            labels: m.acessosPorHora.map(h => h.hora + "h"),
            datasets: [{ data: m.acessosPorHora.map(h => h.total),
              backgroundColor: m.acessosPorHora.map(h => h.total > 5 ? "rgba(255,109,0,.8)" : "rgba(0,230,118,.5)"), borderRadius: 4 }]
          },
          options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#667", font: { size: 10 } } }, y: { ticks: { color: "#667" }, beginAtZero: true } } }
        });
      }

      // Gráficos financeiros (usando dados de Pedidos)
      if (peds && peds.length) {
        buildChart(peds);
        buildPayChart(peds);
        const opEl = document.getElementById("anOperadores");
        if (opEl) {
          opEl.innerHTML = `<div style="font-family:var(--H);font-weight:800;font-size:13px;margin-bottom:8px">👷 Desempenho de Operadores</div><div id="anOpContent"></div>`;
          buildOperadoresPanel(peds, "anOpContent");
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // CUPONS — gestão completa
    // ═══════════════════════════════════════════════════════════════
    let allCupons = [];

    async function loadCupons() {
      const el = document.getElementById("cuponsList");
      if (!el) return;
      el.innerHTML = `<div class="loading"><div class="spin"></div>Carregando...</div>`;
      try {
        const r = await apiGet("getCupons");
        allCupons = r.cupons || [];
        renderCuponsList();
      } catch(e) { el.innerHTML = `<div class="empty">Erro ao carregar cupons.</div>`; }
    }

    function renderCuponsList() {
      const el = document.getElementById("cuponsList");
      if (!el) return;
      if (!allCupons.length) { el.innerHTML = `<div class="empty">Nenhum cupom cadastrado.</div>`; return; }
      el.innerHTML = allCupons.map(c => {
        const ativo = ["sim","SIM","ativo","ATIVO"].includes(String(c["Ativo?"] || c["Status"] || "").trim());
        const usos = Number(c["Usos Realizados"] || 0);
        const max = Number(c["Usos Máx"] || 0);
        const tipo = c["Tipo (% ou R$)"] || c["Tipo"] || "%";
        const val = tipo === "%" ? c["Valor"] + "%" : "R$ " + Number(c["Valor"] || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 });
        const validade = c["Validade"] ? (String(c["Validade"]).includes("T") ? new Date(c["Validade"]).toLocaleDateString("pt-BR") : c["Validade"]) : "—";
        return `<div class="cat-card" style="flex-direction:column;align-items:flex-start">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%">
            <span style="font-family:var(--H);font-size:16px;font-weight:800;letter-spacing:1px">${c["Código"] || "—"}</span>
            <span style="font-size:11px;padding:3px 9px;border-radius:20px;${ativo ? "color:var(--g);background:rgba(0,230,118,.12);border:1px solid rgba(0,230,118,.3)" : "color:var(--muted);background:var(--d3)"}">${ativo ? "Ativo" : "Inativo"}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">${val} · Válido até ${validade} · Usos: ${usos}${max ? "/" + max : ""}</div>
          ${c["Min_Compra_R$"] ? `<div style="font-size:11px;color:var(--c);margin-top:2px">Mín: R$ ${c["Min_Compra_R$"]}</div>` : ""}
          <div class="cat-actions" style="margin-top:8px">
            <button class="cat-btn" data-cup-edit="${c["Código"]}">✏️ Editar</button>
            <button class="cat-btn" style="color:${ativo ? "var(--r)" : "var(--g)"}" data-cup-toggle="${c["Código"]}" data-cup-ativo="${ativo}">${ativo ? "Desativar" : "Ativar"}</button>
          </div>
        </div>`;
      }).join("");
    }

    function openCupomForm(codigo) {
      const c = codigo ? allCupons.find(x => x["Código"] === codigo) : null;
      document.getElementById("cupomFormTitle").textContent = c ? "Editar Cupom" : "Novo Cupom";
      document.getElementById("fCupCodigo").value = c ? c["Código"] || "" : "";
      document.getElementById("fCupTipo").value = c ? (c["Tipo (% ou R$)"] || c["Tipo"] || "%") : "%";
      document.getElementById("fCupValor").value = c ? c["Valor"] || "" : "";
      document.getElementById("fCupValidade").value = c ? c["Validade"] || "" : "";
      document.getElementById("fCupUsoMax").value = c ? c["Usos Máx"] || "" : "";
      document.getElementById("fCupMinCompra").value = c ? c["Min_Compra_R$"] || "" : "";
      document.getElementById("fCupStatus").value = c ? (String(c["Ativo?"]).toLowerCase() === "sim" ? "sim" : "nao") : "sim";
      document.getElementById("cupomFormSection").style.display = "block";
      document.getElementById("fCupCodigo").focus();
    }

    function closeCupomForm() {
      document.getElementById("cupomFormSection").style.display = "none";
    }

    async function salvarCupomAdmin() {
      const codigo = document.getElementById("fCupCodigo").value.trim().toUpperCase();
      if (!codigo) { toast("Informe o código do cupom", "err"); return; }
      const valor = document.getElementById("fCupValor").value;
      if (!valor) { toast("Informe o valor do desconto", "err"); return; }
      const btn = document.getElementById("saveCupomBtn");
      btn.disabled = true; btn.textContent = "Salvando...";
      try {
        const res = await apiGet("salvarCupom", {
          "Código": codigo,
          "Tipo (% ou R$)": document.getElementById("fCupTipo").value,
          "Valor": valor,
          "Validade": document.getElementById("fCupValidade").value,
          "Usos Máx": document.getElementById("fCupUsoMax").value,
          "Usos Realizados": allCupons.find(c => c["Código"] === codigo)?.["Usos Realizados"] || "0",
          "Min_Compra_R$": document.getElementById("fCupMinCompra").value,
          "Ativo?": document.getElementById("fCupStatus").value === "sim" ? "SIM" : "NÃO"
        });
        if (res.ok) { toast("Cupom salvo ✅"); closeCupomForm(); allCupons = []; await loadCupons(); }
        else toast(res.error || "Erro", "err");
      } catch(e) { toast("Erro de conexão", "err"); }
      btn.disabled = false; btn.textContent = "💾 Salvar";
    }

    async function toggleCupom(codigo, atualAtivo) {
      try {
        const c = allCupons.find(x => x["Código"] === codigo);
        if (!c) return;
        const res = await apiGet("salvarCupom", { ...c, "Ativo?": atualAtivo ? "NÃO" : "SIM" });
        if (res.ok) { toast("Cupom atualizado ✅"); allCupons = []; await loadCupons(); }
        else toast(res.error || "Erro", "err");
      } catch(e) { toast("Erro de conexão", "err"); }
    }

    document.getElementById("cuponsList").addEventListener("click", e => {
      const editBtn = e.target.closest("[data-cup-edit]");
      const toggleBtn = e.target.closest("[data-cup-toggle]");
      if (editBtn) { openCupomForm(editBtn.dataset.cupEdit); return; }
      if (toggleBtn) { toggleCupom(toggleBtn.dataset.cupToggle, toggleBtn.dataset.cupAtivo === "true"); return; }
    });

    // OPERADORES
    let _allOps = [];

    async function loadOperadores() {
      const el = document.getElementById("opList");
      if (!el) return;
      el.innerHTML = `<div class="empty">Carregando...</div>`;
      try {
        const r = await apiGet("getOperadores");
        _allOps = r.operadores || [];
        renderOpList(_allOps);
      } catch(e) { el.innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar.</div>`; }
    }

    function renderOpList(ops) {
      const el = document.getElementById("opList");
      if (!el) return;
      if (!ops.length) { el.innerHTML = `<div class="empty">Nenhum operador cadastrado.<br>Clique em <b>+ Novo</b> para adicionar.</div>`; return; }
      el.innerHTML = ops.map(op => {
        const ativo = op.Status !== "Inativo";
        const foto = op.Foto_URL
          ? `<img src="${op.Foto_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : `<span style="font-size:26px">👤</span>`;
        const pedidosOp = allPeds.filter(p => (p["Responsavel"] || "").toLowerCase().trim() === (op.Nome || "").toLowerCase().trim());
        const fat = pedidosOp.reduce((s,p) => s + Number(p["Total (R$)"] || 0), 0);
        return `<div class="cat-card" style="flex-direction:column;align-items:flex-start;gap:8px;opacity:${ativo ? 1 : 0.55}">
          <div style="display:flex;align-items:center;gap:12px;width:100%">
            <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;border:2px solid var(--border);display:flex;align-items:center;justify-content:center;background:var(--d3);flex-shrink:0">${foto}</div>
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--H);font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${op.Nome || "—"}</div>
              <div style="font-size:11px;color:var(--muted)">${op.Cargo || "Sem cargo"} · <span style="color:${ativo ? "var(--g)" : "var(--r)"}">${ativo ? "✅ Ativo" : "⛔ Inativo"}</span></div>
            </div>
          </div>
          ${op.Telefone ? `<div style="font-size:12px;color:var(--muted)">📱 ${op.Telefone}</div>` : ""}
          <div style="font-size:12px;color:var(--c)">${pedidosOp.length} pedido(s) · ${fmt(fat)} faturado</div>
          <div style="display:flex;gap:6px;width:100%;margin-top:4px">
            <button class="kbtn" style="flex:1" data-op-edit="${op.ID}">✏️ Editar</button>
            <button class="kbtn" style="flex:1;color:${ativo ? "var(--r)" : "var(--g)"}" data-op-toggle="${op.ID}" data-op-ativo="${ativo}">
              ${ativo ? "⛔ Inativar" : "✅ Ativar"}
            </button>
            <button class="kbtn" style="color:var(--r)" data-op-del="${op.ID}">🗑️</button>
          </div>
        </div>`;
      }).join("");
    }

    function openOpForm(id) {
      const sec = document.getElementById("opFormSection");
      sec.style.display = "block";
      sec.scrollIntoView({ behavior: "smooth" });
      document.getElementById("opFormTitle").textContent = id ? "✏️ Editar Operador" : "👷 Novo Operador";
      if (id) {
        const op = _allOps.find(o => o.ID === id);
        if (!op) return;
        document.getElementById("fOpId").value = op.ID;
        document.getElementById("fOpNome").value = op.Nome || "";
        document.getElementById("fOpCargo").value = op.Cargo || "";
        document.getElementById("fOpTel").value = op.Telefone || "";
        document.getElementById("fOpEmail").value = op.Email || "";
        document.getElementById("fOpStatus").value = op.Status || "Ativo";
        document.getElementById("fOpFotoUrl").value = op.Foto_URL || "";
        const prev = document.getElementById("opFotoPreview");
        prev.innerHTML = op.Foto_URL ? `<img src="${op.Foto_URL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : "👤";
      } else {
        document.getElementById("fOpId").value = "";
        document.getElementById("fOpNome").value = "";
        document.getElementById("fOpCargo").value = "";
        document.getElementById("fOpTel").value = "";
        document.getElementById("fOpEmail").value = "";
        document.getElementById("fOpStatus").value = "Ativo";
        document.getElementById("fOpFotoUrl").value = "";
        document.getElementById("opFotoPreview").innerHTML = "👤";
      }
    }

    function closeOpForm() {
      document.getElementById("opFormSection").style.display = "none";
    }

    async function uploadOpFoto(input) {
      const file = input.files[0];
      if (!file) return;
      const prev = document.getElementById("opFotoPreview");
      prev.innerHTML = "⏳";
      try {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", CLOUDINARY_PRESET);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, { method: "POST", body: fd });
        const data = await res.json();
        if (data.secure_url) {
          document.getElementById("fOpFotoUrl").value = data.secure_url;
          prev.innerHTML = `<img src="${data.secure_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        } else toast("Erro no upload da foto", "err");
      } catch(e) { toast("Erro no upload", "err"); prev.innerHTML = "👤"; }
    }

    async function salvarOpAdmin() {
      const nome = document.getElementById("fOpNome").value.trim();
      if (!nome) { toast("Nome é obrigatório", "err"); return; }
      const payload = {
        id: document.getElementById("fOpId").value || null,
        nome,
        cargo: document.getElementById("fOpCargo").value.trim(),
        telefone: document.getElementById("fOpTel").value.trim(),
        email: document.getElementById("fOpEmail").value.trim(),
        status: document.getElementById("fOpStatus").value,
        fotoUrl: document.getElementById("fOpFotoUrl").value
      };
      try {
        const r = await apiGet("salvarOperador", payload);
        if (r.ok) {
          toast("Operador salvo ✅");
          closeOpForm();
          loadOperadores();
          _populateOpList();
        } else toast(r.error || "Erro ao salvar", "err");
      } catch(e) { toast("Erro de conexão", "err"); }
    }

    document.getElementById("opList").addEventListener("click", e => {
      const editBtn = e.target.closest("[data-op-edit]");
      const toggleBtn = e.target.closest("[data-op-toggle]");
      const delBtn = e.target.closest("[data-op-del]");
      if (editBtn) { openOpForm(editBtn.dataset.opEdit); return; }
      if (toggleBtn) {
        const id = toggleBtn.dataset.opToggle;
        const isAtivo = toggleBtn.dataset.opAtivo === "true";
        const op = _allOps.find(o => o.ID === id);
        if (!op) return;
        apiGet("salvarOperador", { ...op, id: op.ID, nome: op.Nome, cargo: op.Cargo, telefone: op.Telefone, email: op.Email, fotoUrl: op.Foto_URL, status: isAtivo ? "Inativo" : "Ativo" })
          .then(r => { if (r.ok) { toast("Status atualizado"); loadOperadores(); } else toast(r.error || "Erro", "err"); })
          .catch(() => toast("Erro de conexão", "err"));
        return;
      }
      if (delBtn) {
        toastUndo("Operador removido.",
          async () => {
            const r = await apiGet("deletarOperador", { id: delBtn.dataset.opDel }).catch(() => ({ ok: false }));
            if (r.ok) { if (r.inativado) toast("⚠️ " + (r.aviso || "Operador inativado (tem pedidos vinculados)")); else toast("Operador removido ✅"); loadOperadores(); } else toast(r.error || "Erro ao deletar", "err");
          },
          () => {}
        );
        return;
      }
    });

    // CLIENTES & SCORE (unified)
    let _allClientes = [];

    async function loadClientesPage() {
      const el = document.getElementById("clientesList");
      if (!el) return;
      el.innerHTML = `<div class="empty">Carregando...</div>`;
      try {
        const [scoreRes, clientesRes] = await Promise.all([
          apiGet("getFinanceiro"),
          apiGet("getClientes")
        ]);
        const normNome = n => (n || "").toLowerCase().trim().replace(/\s+/g, " ");
        const baixas = scoreRes.baixas || [];
        const map = {};
        baixas.forEach(b => {
          const key = normNome(b["Nome_Cliente"] || b["Nome Cliente"] || "");
          if (!key) return;
          if (!map[key]) map[key] = { nome: b["Nome_Cliente"] || b["Nome Cliente"] || key, items: [], tel: "", end: "", lastPedido: null };
          if (String(b["Status_Pagamento"] || "") !== "Liquidado") map[key].items.push(b);
          if (!map[key].tel && b["Telefone"]) map[key].tel = b["Telefone"];
        });
        _allClientes = clientesRes.clientes || [];
        _allClientes.forEach(c => {
          const key = normNome(c.nome || "");
          if (map[key]) {
            if (!map[key].tel) map[key].tel = c.telefone || "";
            if (!map[key].end) map[key].end = c.endereco || "";
            map[key].lastPedido = c.ultimoPedido;
          }
        });
        _scoreCache = Object.values(map).sort((a, b) => calcScore(b.items) - calcScore(a.items));
        renderClientesList(_allClientes);
      } catch(e) {
        el.innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar.</div>`;
      }
    }

    function abrirScoreCliente(nome) {
      const sc = _scoreCache.find(s => s.nome.toLowerCase().trim() === (nome || "").toLowerCase().trim());
      const cl = _allClientes.find(c => (c.nome || "").toLowerCase().trim() === (nome || "").toLowerCase().trim());
      if (!sc && !cl) return;
      openScoreModal({
        nome: nome,
        tel: (cl && cl.telefone) || (sc && sc.tel) || "",
        items: sc ? sc.items : [],
        lastPedido: cl ? cl.ultimoPedido : null
      });
    }

    // ─── IMPORTAR CONTATOS (Contact Picker API — Android Chrome) ───────────
    let _contatosImport = [];

    async function importarContatos() {
      if (!("contacts" in navigator) || !("ContactsManager" in window)) {
        // Dispositivo não suporta a API: orienta abrir o formulário manual
        toast("📱 Importação só funciona no Android Chrome. Use '+ Novo' para cadastrar.", "err");
        return;
      }
      try {
        const selecionados = await navigator.contacts.select(["name", "tel"], { multiple: true });
        if (!selecionados || !selecionados.length) return;
        const lista = selecionados
          .map(c => ({
            nome: Array.isArray(c.name) && c.name[0] ? c.name[0].trim() : "",
            tel: Array.isArray(c.tel) && c.tel[0] ? c.tel[0].trim() : ""
          }))
          .filter(c => c.nome);
        if (!lista.length) { toast("Nenhum contato com nome válido selecionado", "err"); return; }
        _abrirImportPreview(lista);
      } catch(e) {
        if (e.name !== "AbortError") toast("Erro ao acessar contatos", "err");
      }
    }

    function _abrirImportPreview(lista) {
      _contatosImport = lista.map(c => ({ ...c }));
      _renderImportList();
      document.getElementById("importOverlay").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function _renderImportList() {
      const el = document.getElementById("importPreviewList");
      if (!el) return;
      const sub = document.getElementById("importSubtitle");
      if (sub) sub.textContent = `${_contatosImport.length} contato${_contatosImport.length !== 1 ? "s" : ""} selecionado${_contatosImport.length !== 1 ? "s" : ""} — edite antes de confirmar`;
      const btn = document.getElementById("importConfirmBtn");
      if (btn) btn.textContent = `Importar ${_contatosImport.length} cliente${_contatosImport.length !== 1 ? "s" : ""}`;
      if (!_contatosImport.length) {
        el.innerHTML = `<div class="empty" style="padding:24px 0">Nenhum contato na lista.</div>`;
        return;
      }
      el.innerHTML = _contatosImport.map((c, i) => `
        <div class="import-contact-row">
          <div class="import-avatar">👤</div>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
            <input class="fi" value="${(c.nome || "").replace(/"/g, "&quot;")}" placeholder="Nome *"
              style="padding:6px 8px;font-size:13px" oninput="_contatosImport[${i}].nome=this.value">
            <input class="fi" value="${(c.tel || "").replace(/"/g, "&quot;")}" placeholder="Telefone"
              style="padding:6px 8px;font-size:13px" type="tel" oninput="_contatosImport[${i}].tel=this.value">
          </div>
          <button class="import-rm" onclick="_contatosImport.splice(${i},1);_renderImportList()">×</button>
        </div>`).join("");
    }

    function fecharImportContatos() {
      document.getElementById("importOverlay").classList.add("hidden");
      document.body.style.overflow = "";
      _contatosImport = [];
    }

    async function confirmarImportContatos() {
      const validos = _contatosImport.filter(c => (c.nome || "").trim());
      if (!validos.length) { toast("Adicione ao menos um contato com nome", "err"); return; }
      const btn = document.getElementById("importConfirmBtn");
      if (btn) { btn.disabled = true; btn.textContent = `Importando 0/${validos.length}…`; }
      let ok = 0, atualiz = 0, erros = 0;
      for (let i = 0; i < validos.length; i++) {
        const c = validos[i];
        try {
          const r = await apiGet("salvarCliente", { nome: c.nome.trim(), telefone: (c.tel || "").trim(), endereco: "" });
          if (r && r.ok) { r.updated ? atualiz++ : ok++; }
          else erros++;
        } catch(e) { erros++; }
        if (btn) btn.textContent = `Importando ${i + 1}/${validos.length}…`;
      }
      if (btn) { btn.disabled = false; btn.textContent = "Importar"; }
      fecharImportContatos();
      const partes = [];
      if (ok) partes.push(`${ok} novo${ok > 1 ? "s" : ""}`);
      if (atualiz) partes.push(`${atualiz} atualizado${atualiz > 1 ? "s" : ""}`);
      if (erros) partes.push(`${erros} erro${erros > 1 ? "s" : ""}`);
      toast(partes.join(" · ") + (erros ? "" : " ✅"), erros && !ok && !atualiz ? "err" : "ok");
      if (ok || atualiz) loadClientesPage();
    }
    // ────────────────────────────────────────────────────────────────────────

    function abrirNovoCliente() {
      document.getElementById("ncNome").value = "";
      document.getElementById("ncTel").value = "";
      document.getElementById("ncEnd").value = "";
      document.getElementById("ncOverlay").classList.remove("hidden");
      document.body.style.overflow = "hidden";
    }

    function fecharNovoCliente() {
      document.getElementById("ncOverlay").classList.add("hidden");
      document.body.style.overflow = "";
    }

    async function salvarNovoCliente() {
      const nome = document.getElementById("ncNome").value.trim();
      const tel = document.getElementById("ncTel").value.trim();
      const end = document.getElementById("ncEnd").value.trim();
      if (!nome) { toast("Nome é obrigatório", "err"); return; }
      const btn = document.querySelector("#ncOverlay .kbtn");
      if (btn) { btn.disabled = true; btn.textContent = "Salvando…"; }
      try {
        const r = await apiGet("salvarCliente", { nome, telefone: tel, endereco: end });
        if (r && r.ok) {
          toast("Cliente cadastrado ✅");
          fecharNovoCliente();
          loadClientesPage();
        } else {
          toast(r?.error || "Erro ao cadastrar", "err");
        }
      } catch(e) {
        toast("Erro de conexão", "err");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Cadastrar Cliente"; }
      }
    }

    async function loadClientes() {
      const el = document.getElementById("clientesList");
      if (!el) return;
      el.innerHTML = `<div class="empty">Carregando...</div>`;
      try {
        const r = await apiGet("getClientes");
        _allClientes = r.clientes || [];
        renderClientesList(_allClientes);
      } catch(e) { el.innerHTML = `<div class="empty" style="color:var(--r)">Erro ao carregar.</div>`; }
    }

    function renderClientesList(list) {
      const el = document.getElementById("clientesList");
      if (!el) return;
      if (!list.length) { el.innerHTML = `<div class="empty">Nenhum cliente encontrado.</div>`; return; }
      el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">` +
        list.map(c => {
          const scoreItems = _scoreCache.find(sc => sc.nome.toLowerCase() === (c.nome || "").toLowerCase());
          const sc = scoreItems ? calcScore(scoreItems.items) : null;
          const scoreBadgeHtml = sc !== null ? scoreBadge(sc) : "";
          const lastP = c.ultimoPedido;
          const lastStatus = lastP ? lastP["Status"] || "—" : "—";
          const lastDate = lastP ? (lastP["Data/Hora"] || "—").split(" ")[0] : "—";
          const safeNome = (c.nome || "").replace(/"/g, "&quot;");
          return `<div class="cat-card" style="flex-direction:column;align-items:flex-start;gap:6px;cursor:pointer" data-nome="${safeNome}" onclick="abrirScoreCliente(this.dataset.nome)">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;width:100%;gap:8px">
              <div>
                <div style="font-family:var(--H);font-weight:800;font-size:14px">${c.nome || "—"}</div>
                ${c.telefone ? `<div style="font-size:12px;color:var(--muted);margin-top:2px">📱 ${c.telefone}</div>` : ""}
              </div>
              ${scoreBadgeHtml}
            </div>
            <div style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
              <span>🛍️ ${(c.pedidos || []).length} pedido(s)</span>
              <span style="color:var(--g)">💰 ${fmt(c.totalGasto)}</span>
            </div>
            <div style="font-size:11px;color:var(--muted)">Último: <b style="color:var(--tx)">${lastDate}</b> · <span class="badge ${bc(lastStatus)}">${lastStatus}</span></div>
            <div style="display:flex;gap:6px;margin-top:4px">
              ${c.telefone ? `<a class="kbtn" href="https://wa.me/55${c.telefone.replace(/\D/g,'')}" target="_blank" onclick="event.stopPropagation()" style="text-decoration:none">💬 WPP</a>` : ""}
            </div>
          </div>`;
        }).join("") + `</div>`;
    }

    function filterClientes(q) {
      if (!_allClientes.length) return;
      const filtered = q.trim()
        ? _allClientes.filter(c => c.nome.toLowerCase().includes(q.toLowerCase()) || (c.telefone || "").includes(q))
        : _allClientes;
      renderClientesList(filtered);
    }

    initTheme();
    // Categorias do cache no boot (sem aguardar login)
    (() => {
      try { const c = localStorage.getItem("gj_cats"); if (c) { allCats = JSON.parse(c); populateCatSelects(); } } catch(e) {}
    })();
