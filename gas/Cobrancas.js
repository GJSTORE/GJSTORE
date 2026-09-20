// ── COBRANÇAS v2 (2026-09-20) ──────────────────────────────────────────────
// Motor de cobrança calculado a partir de Pedidos + Financeiro_Fluxo, SEM mudar o modelo de
// dados: todo pedido em aberto com vencimento aparece (antes só aparecia quem já tinha pago
// parcial). Juros: R$ por dia corrido de atraso (Config JUROS_DIA_RS, padrão 5).
// Autenticação: token admin (adminLogin) — endpoints devolvem nome/telefone/dívida.
// Ver mind/PESQUISA-COBRANCA-2026-09-20.md

var COB_JUROS_DIA_PADRAO = 5;
var COB_TOLERANCIA = 1;
var COB_STATUS_FECHADO = ["Finalizado", "Cancelado", "Deletado"];

// ── helpers puros (sem serviços do Apps Script, testáveis no Node) ──────────
function _cobNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return isNaN(v) ? 0 : v;
  var s = String(v).trim();
  var n = Number(s);
  if (!isNaN(n)) return n;
  n = Number(s.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}
function _cobR2(n) { return Math.round(n * 100) / 100; }

// Aceita Date, "dd/MM/yyyy[ HH:mm]", "yyyy-MM-dd" e serial do Sheets. Devolve Date 00:00 ou null.
function _cobData(v) {
  if (v === null || v === undefined || v === "") return null;
  if (Object.prototype.toString.call(v) === "[object Date]") {
    return isNaN(v.getTime()) ? null : new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  if (typeof v === "number" && v > 40000) return new Date(1899, 11, 30 + Math.floor(v));
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  var n = Number(s);
  if (!isNaN(n) && n > 40000) return new Date(1899, 11, 30 + Math.floor(n));
  return null;
}
function _cobPad(n) { return (n < 10 ? "0" : "") + n; }
function _cobFmt(d) { return _cobPad(d.getDate()) + "/" + _cobPad(d.getMonth() + 1) + "/" + d.getFullYear(); }
function _cobAddDias(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function _cobDiff(a, b) { // a - b em dias
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
                     Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
}
function _cobTelDigitos(t) {
  var d = String(t || "").replace(/\D/g, "");
  if (d.length >= 12 && d.indexOf("55") === 0) d = d.slice(2);
  return d;
}

// Calcula a situação de cobrança de UM pedido. null = nada a cobrar.
// ped: linha de Pedidos · baixas: linhas de Financeiro_Fluxo desse pedido
// hoje: Date · jurosDia: R$/dia · itensFn: (opcional) resume o JSON de itens · tetoPct: teto dos juros em % da parcela (0 = sem teto)
function _cobCalcular(ped, baixas, hoje, jurosDia, itensFn, tetoPct) {
  var status = String(ped["Status"] || "");
  if (COB_STATUS_FECHADO.indexOf(status) >= 0) return null;
  var total = _cobNum(ped["Total (R$)"]);
  if (total <= 0.01) return null;

  var pago = 0, pend = null;
  (baixas || []).forEach(function(b) {
    var st = String(b["Status_Pagamento"] || "");
    if (st === "Pendente") {
      if (!pend || String(b["ID_Baixa"] || "") > String(pend["ID_Baixa"] || "")) pend = b;
      return;
    }
    if (st === "Liquidado") return;
    pago += Math.max(0, _cobNum(b["Valor_Final_Recebido"]) - _cobNum(b["Taxa_Aplicada_RS"]));
  });
  var saldo = _cobR2(total - pago);
  if (saldo <= 0.01) return null;

  var n = Math.max(1, Math.round(_cobNum(ped["Qtd_Parcelas"])) || 1);
  var intervalo = _cobNum(ped["Intervalo_Dias"]);
  if (intervalo <= 0) intervalo = 30;
  var parcelaVal = total / n;
  var k = Math.min(n - 1, Math.floor((pago + COB_TOLERANCIA) / parcelaVal));   // parcelas já cobertas (folga de R$1 p/ centavos)
  var valorAgora = (k >= n - 1) ? saldo : Math.min(saldo, _cobR2((k + 1) * parcelaVal - pago));
  if (valorAgora <= 0.01) valorAgora = saldo;

  // vencimento: data combinada na última parcela parcial (Pendente) manda; senão o cronograma
  var venc = pend ? _cobData(pend["Proxima_Vencimento"]) : null;
  if (!venc) {
    var primeira = _cobData(ped["Data_Vencimento"]);
    if (primeira) venc = _cobAddDias(primeira, k * intervalo);
  }
  // Pendente sem data e sem baixa parcial = pedido da loja ainda não confirmado, não é dívida
  if (!venc && !(status === "Entregue" || status === "Em andamento" || pend)) return null;

  var diff = venc ? _cobDiff(venc, hoje) : null;             // negativo = atrasado
  var atraso = diff !== null && diff < 0 ? -diff : 0;
  var juros = atraso * jurosDia;
  if (tetoPct > 0) juros = Math.min(juros, valorAgora * tetoPct / 100);
  juros = _cobR2(juros);
  var urgencia = diff === null ? "sem_data" : diff < 0 ? "atrasado" : diff === 0 ? "hoje"
               : diff === 1 ? "amanha" : diff <= 7 ? "proximo" : "futuro";
  var estagio = diff === null ? "sem_data" : diff >= 2 ? "antes" : diff === 1 ? "amanha" : diff === 0 ? "hoje"
              : atraso >= 15 ? "negociar" : atraso >= 7 ? "atraso_juros" : "atraso";

  var resumo = "";
  try { if (itensFn) resumo = itensFn(ped["Itens (JSON)"] || ped["Itens"]); } catch (e) {}
  return {
    idPedido: String(ped["ID Pedido"] || ""),
    nome: String(ped["Nome Cliente"] || ""),
    telefone: _cobTelDigitos(ped["Telefone"]),
    itens: resumo || "",
    pedidoStatus: status,
    total: _cobR2(total), pago: _cobR2(pago), saldo: saldo,
    valor: _cobR2(valorAgora), juros: juros, valorComJuros: _cobR2(valorAgora + juros),
    parcela: k + 1, parcelas: n,
    vencimento: venc ? _cobFmt(venc) : "", diasParaVencer: diff, diasAtraso: atraso,
    urgencia: urgencia, estagio: estagio
  };
}

// ── endpoints ───────────────────────────────────────────────────────────────
function _cobJurosDia() {
  var v = _cobNum(getConfigValue("JUROS_DIA_RS"));
  return v > 0 ? v : COB_JUROS_DIA_PADRAO;
}
function _cobJurosTeto() { var v = _cobNum(getConfigValue("JUROS_TETO_PCT")); return v > 0 ? v : 0; }
function _cobHoje() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

function _cobBaixasPorPedido() {
  var map = {};
  if (!getSheet("Financeiro_Fluxo")) return map;
  sheetToObjects("Financeiro_Fluxo").forEach(function(b) {
    var id = String(b["ID_Pedido"] || "");
    if (!id) return;
    (map[id] = map[id] || []).push(b);
  });
  return map;
}

function getCobrancasV2(p) {
  if (!adminLoginId(p && p.token)) return { ok: false, error: "Não autorizado" };
  try {
    var hoje = _cobHoje(), jurosDia = _cobJurosDia(), teto = _cobJurosTeto();
    var baixasMap = _cobBaixasPorPedido();
    var lista = [];
    sheetToObjects("Pedidos").forEach(function(ped) {
      var it = _cobCalcular(ped, baixasMap[String(ped["ID Pedido"] || "")] || [], hoje, jurosDia,
                            typeof _itensResumo === "function" ? _itensResumo : null, teto);
      if (it) lista.push(it);
    });
    var ordem = { atrasado: 0, hoje: 1, amanha: 2, proximo: 3, futuro: 4, sem_data: 5 };
    lista.sort(function(a, b) {
      if (ordem[a.urgencia] !== ordem[b.urgencia]) return ordem[a.urgencia] - ordem[b.urgencia];
      if (a.urgencia === "atrasado") return b.diasAtraso - a.diasAtraso;
      return (a.diasParaVencer || 0) - (b.diasParaVencer || 0);
    });
    var t = { aReceber: 0, atrasado: 0, jurosAcumulado: 0, qtdAtrasado: 0, qtdHoje: 0, valorHoje: 0,
              qtdAmanha: 0, valorAmanha: 0, qtdSemData: 0, qtdTotal: lista.length };
    lista.forEach(function(c) {
      t.aReceber += c.saldo;
      if (c.urgencia === "atrasado") { t.atrasado += c.valor; t.jurosAcumulado += c.juros; t.qtdAtrasado++; }
      if (c.urgencia === "hoje")     { t.qtdHoje++;   t.valorHoje += c.valor; }
      if (c.urgencia === "amanha")   { t.qtdAmanha++; t.valorAmanha += c.valor; }
      if (c.urgencia === "sem_data") t.qtdSemData++;
    });
    ["aReceber", "atrasado", "jurosAcumulado", "valorHoje", "valorAmanha"].forEach(function(k) { t[k] = _cobR2(t[k]); });
    return { ok: true, hoje: _cobFmt(hoje), jurosDia: jurosDia, jurosTetoPct: teto, cobrancas: lista, totais: t };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Registra um recebimento em uma chamada só. Juros = R$/dia × dias de atraso da parcela,
// cobrados primeiro; o resto abate o principal. perdoarJuros=1 zera os juros.
function receberCobranca(p) {
  if (!adminLoginId(p && p.token)) return { ok: false, error: "Não autorizado" };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, error: "Sistema ocupado, tente de novo" }; }
  try {
    var id = String(p.idPedido || "");
    var found = findRow("Pedidos", 0, id);
    if (!found) return { ok: false, error: "Pedido não encontrado" };
    var headers = getHeaders("Pedidos");
    var ped = {};
    headers.forEach(function(h, i) { ped[h] = found.row[i]; });

    var dataPag = _cobData(p.dataPagamento) || _cobHoje();
    var jurosDia = _cobJurosDia();
    var baixasPed = (_cobBaixasPorPedido()[id]) || [];
    var it = _cobCalcular(ped, baixasPed, dataPag, jurosDia, null, _cobJurosTeto());
    if (!it) return { ok: false, error: "Nada a receber neste pedido (já quitado ou cancelado)" };

    var juros = (String(p.perdoarJuros) === "1" || p.perdoarJuros === true) ? 0 : it.juros;
    var devido = _cobR2(it.valor + juros);
    var recebido = (p.valor !== undefined && p.valor !== "" && p.valor !== null) ? _cobR2(_cobNum(p.valor)) : devido;
    if (recebido <= 0) return { ok: false, error: "Valor inválido" };
    if (recebido > it.saldo + juros + 0.01) return { ok: false, error: "Valor maior que a dívida (R$ " + (it.saldo + juros).toFixed(2).replace(".", ",") + ")" };

    var jurosPagos = Math.min(juros, recebido);
    var principal = _cobR2(recebido - jurosPagos);
    var novoPago = _cobR2(it.pago + principal);
    var novoSaldo = _cobR2(it.total - novoPago);
    var quitado = novoSaldo <= 0.01;
    if (quitado) novoSaldo = 0;
    var cobriuParcela = principal + COB_TOLERANCIA >= it.valor;

    var venc = _cobData(it.vencimento);
    var pontual = !!(venc && dataPag.getTime() <= venc.getTime());
    var statusPag;
    if (!quitado && !cobriuParcela) statusPag = "Pago Parcial";
    else if (it.diasAtraso > 0 && dataPag.getTime() > (venc ? venc.getTime() : 0)) statusPag = jurosPagos > 0 ? "Atrasado COM Taxa" : "Atrasado SEM Taxa";
    else statusPag = (venc && dataPag.getTime() < venc.getTime()) ? "Antecipado" : "No Prazo";
    var diasAtrasoPag = venc && dataPag.getTime() > venc.getTime() ? _cobDiff(dataPag, venc) : 0;

    // fecha as linhas Pendente antigas (mesmo critério do darBaixa)
    var hFin = getHeaders("Financeiro_Fluxo");
    var colStat = hFin.indexOf("Status_Pagamento") + 1;
    baixasPed.filter(function(b) { return String(b["Status_Pagamento"] || "") === "Pendente"; }).forEach(function(b) {
      var linha = findRow("Financeiro_Fluxo", 0, b["ID_Baixa"]);
      if (linha && colStat > 0) linha.sh.getRange(linha.rowNum, colStat).setValue("Liquidado");
    });

    var tel = String(ped["Telefone"] || "");
    var nome = String(ped["Nome Cliente"] || "");
    var dataBaixaStr = (p.dataPagamento && _cobFmt(dataPag) !== _cobFmt(_cobHoje())) ? _cobFmt(dataPag) : nowBR();
    appendRowByHeaders("Financeiro_Fluxo", {
      ID_Baixa: newId("BX"), ID_Pedido: id, Nome_Cliente: nome,
      Valor_Original: it.total, Status_Pagamento: statusPag, Dias_Atraso: diasAtrasoPag,
      Taxa_Aplicada_RS: jurosPagos.toFixed(2), Valor_Final_Recebido: recebido.toFixed(2),
      Data_Baixa_Efetiva: dataBaixaStr, Saldo_Restante: novoSaldo.toFixed(2),
      Proxima_Vencimento: "", Telefone: tel, Forma_Pagamento: String(p.forma || "")
    });

    var proxima = "";
    if (!quitado) {
      var intervalo = _cobNum(ped["Intervalo_Dias"]); if (intervalo <= 0) intervalo = 30;
      var proxData = _cobData(p.proximaVencimento);
      if (!proxData) {
        if (cobriuParcela) {
          var primeira = _cobData(ped["Data_Vencimento"]) || venc || dataPag;
          var kNovo = Math.min(it.parcelas - 1, Math.floor((novoPago + COB_TOLERANCIA) / (it.total / it.parcelas)));
          proxData = _cobAddDias(primeira, kNovo * intervalo);
        } else {
          proxData = venc || _cobAddDias(dataPag, intervalo);   // parcial: mantém a data
        }
      }
      proxima = _cobFmt(proxData);
      appendRowByHeaders("Financeiro_Fluxo", {
        ID_Baixa: newId("BX"), ID_Pedido: id, Nome_Cliente: nome,
        Valor_Original: novoSaldo, Status_Pagamento: "Pendente", Dias_Atraso: 0,
        Taxa_Aplicada_RS: "0.00", Valor_Final_Recebido: "0.00",
        Data_Baixa_Efetiva: "", Saldo_Restante: novoSaldo.toFixed(2),
        Proxima_Vencimento: proxima, Telefone: tel, Forma_Pagamento: String(p.forma || "")
      });
      var colSt = headers.indexOf("Status") + 1;
      var stAtual = String(ped["Status"] || "");
      if (colSt > 0 && stAtual !== "Entregue" && stAtual !== "Em andamento") found.sh.getRange(found.rowNum, colSt).setValue("Em andamento");
    } else {
      var colS = headers.indexOf("Status") + 1;
      if (colS > 0) found.sh.getRange(found.rowNum, colS).setValue("Finalizado");
      var colFin = headers.indexOf("Data_Finalizacao") + 1;
      if (colFin > 0) found.sh.getRange(found.rowNum, colFin).setValue(nowBR());
      var colEv = headers.indexOf("ID_Evento_Agenda_Cobranca") + 1;
      if (colEv > 0 && ped["ID_Evento_Agenda_Cobranca"]) {
        try { var ev = CalendarApp.getDefaultCalendar().getEventById(String(ped["ID_Evento_Agenda_Cobranca"])); if (ev) ev.deleteEvent(); }
        catch (err) { console.warn("Remoção agenda: " + err.message); }
      }
    }

    try {
      if (statusPag !== "Pago Parcial") atualizarScore(nome, tel, statusPag, diasAtrasoPag);
      else atualizarScore(nome, tel, "No Prazo", 0);
    } catch (err) { console.error("atualizarScore receberCobranca: " + err.message); }
    try { registrarAcao(p.operador || "admin", "receberCobranca", "Pedido", id, "R$ " + recebido.toFixed(2) + " (" + statusPag + ", juros " + jurosPagos.toFixed(2) + ", " + (p.forma || "s/forma") + ")"); } catch (err) {}

    return {
      ok: true, quitado: quitado, statusPagamento: statusPag, pontual: pontual,
      recebido: recebido, jurosCobrados: jurosPagos, principal: principal,
      novoSaldo: novoSaldo, proximaVencimento: proxima, diasAtraso: diasAtrasoPag,
      parcela: it.parcela, parcelas: it.parcelas, total: it.total,
      nomeCliente: nome, telefone: _cobTelDigitos(tel), idPedido: id, forma: String(p.forma || "")
    };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { try { lock.releaseLock(); } catch (e2) {} }
}

// Combinou nova data com o cliente: grava como a data de vencimento em aberto do pedido.
function adiarCobranca(p) {
  if (!adminLoginId(p && p.token)) return { ok: false, error: "Não autorizado" };
  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (e) { return { ok: false, error: "Sistema ocupado, tente de novo" }; }
  try {
    var id = String(p.idPedido || "");
    var nova = _cobData(p.novaData);
    if (!nova) return { ok: false, error: "Data inválida" };
    var found = findRow("Pedidos", 0, id);
    if (!found) return { ok: false, error: "Pedido não encontrado" };
    var headers = getHeaders("Pedidos");
    var ped = {};
    headers.forEach(function(h, i) { ped[h] = found.row[i]; });
    var baixasPed = (_cobBaixasPorPedido()[id]) || [];
    var it = _cobCalcular(ped, baixasPed, _cobHoje(), _cobJurosDia(), null, _cobJurosTeto());
    if (!it) return { ok: false, error: "Nada em aberto neste pedido" };

    var hFin = getHeaders("Financeiro_Fluxo");
    var colStat = hFin.indexOf("Status_Pagamento") + 1;
    baixasPed.filter(function(b) { return String(b["Status_Pagamento"] || "") === "Pendente"; }).forEach(function(b) {
      var linha = findRow("Financeiro_Fluxo", 0, b["ID_Baixa"]);
      if (linha && colStat > 0) linha.sh.getRange(linha.rowNum, colStat).setValue("Liquidado");
    });
    appendRowByHeaders("Financeiro_Fluxo", {
      ID_Baixa: newId("BX"), ID_Pedido: id, Nome_Cliente: String(ped["Nome Cliente"] || ""),
      Valor_Original: it.saldo, Status_Pagamento: "Pendente", Dias_Atraso: 0,
      Taxa_Aplicada_RS: "0.00", Valor_Final_Recebido: "0.00",
      Data_Baixa_Efetiva: "", Saldo_Restante: it.saldo.toFixed(2),
      Proxima_Vencimento: _cobFmt(nova), Telefone: String(ped["Telefone"] || ""), Forma_Pagamento: ""
    });
    try { registrarAcao(p.operador || "admin", "adiarCobranca", "Pedido", id, "vencimento " + it.vencimento + " → " + _cobFmt(nova)); } catch (err) {}
    return { ok: true, idPedido: id, vencimentoAnterior: it.vencimento, novoVencimento: _cobFmt(nova) };
  } catch (e) { return { ok: false, error: e.message }; }
  finally { try { lock.releaseLock(); } catch (e2) {} }
}

// Diagnóstico de por que a GRAVAÇÃO na planilha falha ("Você não tem permissão para acessar o
// documento"): mostra se a conta que executa o script ainda é EDITORA da planilha e quanto do
// Drive está ocupado. Só admin. E-mails mascarados.
function diagnosticoDrive(p) {
  if (!adminLoginId(p && p.token)) return { ok: false, error: "Não autorizado" };
  function mask(e) { e = String(e || ""); var i = e.indexOf("@"); return i > 2 ? e.slice(0, 3) + "***" + e.slice(i) : e; }
  var out = { ok: true };
  try {
    var usado = DriveApp.getStorageUsed(), limite = DriveApp.getStorageLimit();
    out.driveUsadoGB = Math.round(usado / 1e7) / 100;
    out.limiteContaGB = Math.round(limite / 1e7) / 100;
    out.driveUsadoPct = limite ? Math.round(usado / limite * 1000) / 10 : null;
  } catch (e) { out.erroQuota = e.message; }
  try {
    var user = Session.getEffectiveUser();
    var f = DriveApp.getFileById(SS.getId());
    out.executor = mask(user.getEmail());
    out.donoPlanilha = mask(f.getOwner() ? f.getOwner().getEmail() : "");
    out.acessoDoExecutor = String(f.getAccess(user));
    out.compartilhamento = String(f.getSharingAccess()) + "/" + String(f.getSharingPermission());
    out.tamanhoPlanilhaMB = Math.round(f.getSize() / 1e4) / 100;
  } catch (e) { out.erroArquivo = e.message; }
  try { out.abasLidas = SS.getSheets().length; } catch (e) { out.erroLeitura = e.message; }
  return out;
}
