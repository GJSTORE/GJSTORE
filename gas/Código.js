// ================================================================
// GJ STORE \u2014 Apps Script v4
// FEATURES: Financeiro, Agenda, CRM, Baixas, Acessos_Log,
//           Email, Drive Comprovante, Previsão Caixa, Produtos Recentes
// Reimplante após colar: Implantar \u2192 Gerenciar \u2192 Nova versão
// ================================================================

// URL atual (v8): AKfycbzBuqMeTDLoFie4yTaMmwm6GufE3HRnpqQ7r3v1emlWLoUp1DDxWxRjbbKA4xfW6Xuh
const SS = SpreadsheetApp.openById("1z1pP3q95qk906MpdVP5ymNwx9Vr3B6-6VimtuaROu30");

// ── CACHE DE SCRIPT (evita reler planilha na mesma execução) ──
var _PROD_ROWS = null;

// ── GEMINI VISION (identificação de produtos) ──
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL_VISION = 'gemini-1.5-flash';
function getGeminiKey() { return PropertiesService.getScriptProperties().getProperty('GEMINI_KEY'); }

function geminiVisionRequest(imageBase64, mimeType, prompt, maxTokens = 1024) {
  const key = getGeminiKey();
  if (!key) return { error: 'GEMINI_KEY não configurada nas Script Properties' };
  const url = GEMINI_API + '/' + GEMINI_MODEL_VISION + ':generateContent?key=' + key;
  const payload = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: mimeType, data: imageBase64 } },
        { text: prompt }
      ]
    }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2,
      responseMimeType: 'application/json',
    }
  };
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });
      const code = res.getResponseCode();
      const json = JSON.parse(res.getContentText());
      if (code === 200) {
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return { text: text, usage: { input: json.usageMetadata?.promptTokenCount || 0, output: json.usageMetadata?.candidatesTokenCount || 0 } };
      }
      if (code === 429 && attempt < 2) { Utilities.sleep(2000 * Math.pow(2, attempt)); continue; }
      throw new Error('Gemini ' + code + ': ' + (json.error?.message || JSON.stringify(json)));
    } catch (e) { if (attempt === 2) throw e; Utilities.sleep(500); }
  }
}

const IDENTIFY_PROMPT = 'Analise esta foto de tênis/calçado. Identifique: marca, modelo, cor predominante, estilo (casual/esportivo/infantil/social), e gera um nome de produto profissional para e-commerce.\n\nRetorne APENAS JSON válido:\n{\n  "marca": "Nike",\n  "modelo": "Air Force 1",\n  "cor": "Branco",\n  "estilo": "Casual",\n  "nome_produto": "Tênis Nike Air Force 1 Branco",\n  "descricao": "Tênis Nike Air Force 1 casual em couro branco. Palmilha confortável, solado em borracha. Perfeito para o dia a dia."\n}\n\nSe não conseguir identificar marca/modelo, use descrição genérica mas precisa (ex: "Tênis Casual Masculino Preto com Sola Branca").';

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// \u2500\u2500 ROTEADOR \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function doGet(e) {
  return jsonResponse(handleAction(e.parameter || {}));
}

// POST: usado para ações com dado sensível (senha, token) que não pode ir na query string
// (query é logada nos logs de execução do GAS e no histórico do navegador).
// Content-Type text/plain no front evita preflight CORS.
function doPost(e) {
  var p = {};
  try { p = JSON.parse((e.postData && e.postData.contents) || "{}"); } catch (err) { console.error("doPost JSON parse: " + err.message); }
  if (e && e.parameter) for (var k in e.parameter) if (!(k in p)) p[k] = e.parameter[k];
  return jsonResponse(handleAction(p));
}

function handleAction(p) {
  const action = p.action || "";
  let result;
  try {
    switch (action) {
      // AUTH CLIENTE
      case "cadastrarCliente":     result = cadastrarCliente(p);                break;
      case "loginCliente":         result = loginCliente(p);                    break;
      case "verificarCliente":     result = verificarCliente(p);                break;
      case "resetarSenhaCliente":  result = resetarSenhaCliente(p);             break;
      // LEITURA
      case "getConfig":            result = getConfig();                        break;
      case "getBanners":           result = getBanners();                       break;
      case "getDestaques":         result = getDestaques();                     break;
      case "getDestaqueAtivo":     result = getDestaqueAtivo();                 break;
      case "salvarDestaque":       result = salvarDestaque(p);                  break;
      case "deletarDestaque":      result = deletarDestaque(p.id);              break;
      case "getProdutos":          result = getProdutos(p);                     break;
      case "getFrete":             result = getFrete();                         break;
      case "getCupom":             result = getCupom(p.codigo);                 break;
      case "getPedidos":           result = getPedidos(p);                      break;
      case "getFinanceiro":        result = getFinanceiro(p);                   break;
      case "getCRM":               result = getCRM();                           break;
      case "getPrevisaoCaixa":     result = getPrevisaoCaixa();                 break;
    case "getResumoPeriodo":     result = getResumoPeriodo(p);                break;
    case "salvarConfigValor":    result = salvarConfigValor(p);               break;
      case "getCategorias":        result = getCategorias();                    break;
      case "getClientesScore":     result = getClientesScore();                 break;
      case "getTemas":             result = getTemas();                         break;
      // AUTH
      case "adminLogin":           result = adminLogin(p);                       break;
      // ESCRITA
      case "novoPedido":           result = novoPedido(p);                      break;
      case "salvarProduto":        result = salvarProduto(p);                   break;
      case "deletarProduto":       result = deletarProduto(p.id);               break;
      case "excluirProdutoHard":   result = excluirProdutoHard(p);              break;
      case "deduplicarProdutos":   result = deduplicarProdutos();               break;
      case "addColunasProdutos":   result = addColunasProdutos();               break;
      case "deletarPedido":        result = deletarPedido(p.id);               break;
      case "atualizarStatus":      result = atualizarStatus(p.id, p.status, p); break;
      case "setPedDates":          result = setPedDates(p);                    break;
      case "editarPedido":         result = editarPedido(p);                   break;
      case "getCupons":            result = getCupons();                        break;
      case "salvarCupom":          result = salvarCupom(p);                     break;
      case "darBaixa":             result = darBaixa(p);                        break;
      case "logAcao":              result = logAcao(p);                         break;
      case "getMetricas":          result = getMetricas(p);                     break;
      case "getFinanceiroPendente": result = getFinanceiroPendente();            break;
      case "logAcesso":            result = logAcesso(p);                       break;
      case "logCarrinho":          result = logCarrinho(p);                     break;
      case "gerarComprovanteDrive":result = gerarComprovanteDrive(p);           break;
      case "salvarCategoria":      result = salvarCategoria(p);                 break;
      case "toggleCategoria":      result = toggleCategoria(p);                 break;
      case "deletarCategoria":     result = deletarCategoria(p.id);             break;
      case "getOperadores":        result = getOperadores();                    break;
      case "criarCupomReengajamento": result = criarCupomReengajamento(p);     break;
      case "getKPIs":             result = getKPIs();                          break;
      case "salvarOperador":       result = salvarOperador(p);                  break;
      case "deletarOperador":      result = deletarOperador(p.id, p);            break;
      case "definirSenhaOperador": result = definirSenhaOperador(p.id, p.senha); break;
      case "operadorLogin":        result = operadorLogin(p.id, p.senha);        break;
      case "getClientes":          result = getClientes(p);                     break;
      case "salvarCliente":        result = salvarCliente(p);                   break;
      case "deletarCliente":       result = deletarCliente(p.id, p);             break;
      case "importarContatos":     result = importarContatos(p);                break;
      case "getParcelasPedido":    result = getParcelasPedido(p.idPedido);      break;
      case "getAnalytics":         result = getAnalytics(p);                    break;
      case "getLucroPorProduto":   result = getLucroPorProduto(p);              break;
      case "migrarAbas":           result = migrarAbas();                       break;
      case "getCarrinhosAbandonados": result = getCarrinhosAbandonados(p);      break;
      case "rastrear":             result = rastrearPedido(p.id || "");                break;
      case "getMinhasCompras":    result = getMinhasCompras(p);                     break;
      case "ping":                 result = { ok: true, pong: true, ts: new Date().toISOString() }; break;
      case "setupSheets":          result = setupSheetsV2();                    break;
      case "formatarPlanilha":    result = formatarPlanilhaCompleta();         break;
      case "criarDashboard":      result = criarDashboardNativo(p);            break;
      case "atualizarDashboard":  atualizarDashboard(); result = { ok: true }; break;
      case "vendaPDV":             result = vendaPDV(p);                        break;
      case "setupTriggers":       result = setupTodosOsTriggers();            break;
      case "getTriggersStatus":   result = getTriggersStatus();               break;
      case "corrigirHeaders":     result = corrigirHeaders();                  break;
      // E4.4: mensagem reflete o resultado real da função (enviado ou não, e por quê) —
      // antes sempre dizia "enviado" mesmo quando a função não achava nada pra mandar
      case "testarSLA":            result = { ok: true, msg: (verificarSLA() || {}).motivo || "SLA verificado" }; break;
      case "testarDigest":         result = { ok: true, msg: (enviarMorningDigest() || {}).motivo || "Digest enviado" }; break;
      case "testarVencimento":     result = { ok: true, msg: (alertaVencimentoAmanha() || {}).motivo || "Alerta D-1 verificado" }; break;
      case "testarGarantia":       result = { ok: true, msg: (verificarGarantia() || {}).motivo || "Verificação de garantia concluída" }; break;
      case "testarBackup":         { const b = backupPlanilha(); result = b.ok ? { ok: true, msg: "Backup criado: " + b.arquivo + (b.removidos ? " · " + b.removidos + " antigo(s) removido(s)" : "") } : { ok: false, error: b.erro }; } break;
      case "excluirPedidoHard":    result = excluirPedidoHard(p);               break;
      case "getCobrancasPendentes": result = getCobrancasPendentes();           break;
      case "getLogAcoes":          result = getLogAcoes(p);                     break;
      case "analyticsHealth":      result = analyticsHealth();                  break;
      case "getVisitorMap":        result = getVisitorMap(p);                   break;
      case "getPedidoById":        result = getPedidoById(p);                   break;
      case "identificarProduto":   result = identificarProduto(p);              break;
      case "atualizarNomeProduto": result = atualizarNomeProduto(p);            break;
      case "salvarProdutosBatch":  result = salvarProdutosBatch(p);             break;
      case "atualizarProdutosBatch": result = atualizarProdutosBatch(p);        break;
      case "excluirProdutosBatch":  result = excluirProdutosBatch(p);            break;
      case "fixarIDsVazios":        result = fixarIDsVazios();                   break;
      case "debugFindRow":          result = debugFindRow(p);                   break;
      case "debugSalvar":           result = debugSalvar(p);                    break;
      case "testarEscrita":         result = testarEscrita(p);                  break;
      case "deduplicarPorNome":     result = deduplicarPorNome(p);              break;
      default:                     result = { ok: false, error: "Ação desconhecida: " + action };
    }
    // E1.2: auditoria automática de toda escrita sensível (excluirPedidoHard registra interno)
    const AUDIT = { novoPedido: "Pedido", atualizarStatus: "Pedido", editarPedido: "Pedido",
      darBaixa: "Baixa", deletarPedido: "Pedido", salvarProduto: "Produto", deletarProduto: "Produto",
      toggleCategoria: "Categoria", salvarCategoria: "Categoria", deletarCategoria: "Categoria",
      salvarCliente: "Cliente", deletarCliente: "Cliente", salvarCupom: "Cupom", vendaPDV: "Pedido",
      salvarDestaque: "Destaque", deletarDestaque: "Destaque" };
    if (AUDIT[action] && result && result.ok) {
      registrarAcao(p.operador, action, AUDIT[action],
        p.id || p.idPedido || (result.idPedido || result.id) || "",
        p.status ? "status→" + p.status : (p.valorPago ? "valor R$" + p.valorPago : ""));
    }
  } catch (err) {
    // X2: exceção não tratada de QUALQUER action sempre volta ok:false — front pode confiar em `if(!res.ok)`
    // sem precisar checar `res.error` separado (padrão inconsistente era a causa raiz do X2)
    result = { ok: false, error: err.message };
  }
  return result;
}

// \u2500\u2500 RASTREAR PEDIDO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// GET ?action=rastrear&id=A3K7M \u2192 { ok, pedido: { id, status, nome, data, total, itens } }
function rastrearPedido(idPedido) {
  try {
    const ss = SS;
    const sheet = ss.getSheetByName("Pedidos") || ss.getSheetByName("pedidos");
    if (!sheet) return { ok: false, erro: "Aba Pedidos não encontrada" };

    const rows = sheet.getDataRange().getValues();
    const h = rows[0];
    // PRIVACIDADE (v3): rastreio por ID só devolve status + data. Nada pessoal (nome/total/itens).
    const iId     = h.indexOf("ID Pedido");
    const iStatus = h.indexOf("Status");
    const iData   = h.indexOf("Data/Hora");

    const row = rows.slice(1).find(r => String(r[iId]).trim().toUpperCase() === String(idPedido).trim().toUpperCase());
    if (!row) return { ok: false };

    return {
      ok: true,
      pedido: {
        id:     row[iId],
        status: row[iStatus] || "Pendente",
        data:   iData >= 0 && row[iData] ? new Date(row[iData]).toLocaleDateString("pt-BR") : "",
      }
    };
  } catch (e) {
    Logger.log("rastrearPedido erro: " + e);
    return { ok: false, erro: String(e) };
  }
}

// Normaliza telefone BR: só dígitos, remove DDI 55. Núcleo = DDD(2) + últimos 8 dígitos
// (cobre salvos com/sem 55 e com/sem o 9º dígito, sem colidir entre DDDs)
function normTelBR(t) {
  var d = String(t || "").replace(/\D/g, "");
  if (d.length > 11 && d.indexOf("55") === 0) d = d.slice(2);
  return d;
}
function telCore(t) {
  var d = normTelBR(t);
  return d.length >= 10 ? d.slice(0, 2) + d.slice(-8) : d;
}

function getMinhasCompras(p) {
  // Travado: exige token de sessão. Telefone vem do token (não do que o client mandar),
  // pra ninguém consultar pedidos de outro só sabendo o número. → [[ROADMAP-EVOLUCAO]] G3
  var telefone = _authTelefoneFromToken(p && p.token);
  if (!telefone) return { ok: false, erro: "Sessão inválida ou expirada", authRequired: true };
  const alvo = telCore(telefone);
  if (!alvo) return { ok: false, erro: "Telefone inválido" };
  try {
    const rows = sheetToObjects("Pedidos");

    // Baixas (Financeiro_Fluxo) lidas 1x e agrupadas por ID_Pedido — recibo do cliente
    // espelha o do admin (parcelas, saldo devedor, quitado).
    var baixasPorPedido = {};
    try {
      sheetToObjects("Financeiro_Fluxo").forEach(function(b) {
        var pid = String(b["ID_Pedido"] || "");
        if (!pid) return;
        (baixasPorPedido[pid] = baixasPorPedido[pid] || []).push({
          Status_Pagamento:     b["Status_Pagamento"]     || "",
          Valor_Original:        Number(b["Valor_Original"] || 0),
          Valor_Final_Recebido: Number(b["Valor_Final_Recebido"] || 0),
          Saldo_Restante:        Number(b["Saldo_Restante"]  || 0),
          Taxa_Aplicada_RS:     Number(b["Taxa_Aplicada_RS"] || 0),
          Data_Baixa_Efetiva:   b["Data_Baixa_Efetiva"]   || "",
          Proxima_Vencimento:   b["Proxima_Vencimento"]   || "",
        });
      });
    } catch (eb) {}

    const pedidos = rows
      .filter(function(r) {
        return telCore(r["Telefone"]) === alvo;
      })
      .map(function(r) {
        var dataVal = r["Data/Hora"];
        var dataFmt = "";
        try { dataFmt = dataVal ? new Date(dataVal).toLocaleDateString("pt-BR") : ""; } catch(e2) {}
        var pid = r["ID Pedido"] || "";
        return {
          id:            pid,
          status:        r["Status"] || "Pendente",
          nome:          r["Nome Cliente"] || "",
          total:         Number(r["Total (R$)"] || 0),
          subtotal:      Number(r["Subtotal (R$)"] || r["Total (R$)"] || 0),
          desconto:      Number(r["Desconto (R$)"] || 0),
          itens:         r["Itens (JSON)"] || "[]",
          formaPagamento: r["Forma Pagamento"] || "",
          obs:           r["Observações"] || "",
          endereco:      r["Endereco"] || r["Endereço"] || "",
          cep:           r["CEP"] != null ? String(r["CEP"]) : "",
          qtdParcelas:   Number(r["Qtd_Parcelas"] || 0),
          data:          dataFmt,
          baixas:        baixasPorPedido[String(pid)] || [],
        };
      })
      .reverse();
    return { ok: true, pedidos: pedidos };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

function autoRegistrarCliente(nome, telefone, primeiroIdPedido) {
  if (!telefone) return;
  const tel = String(telefone).replace(/\D/g, "");
  try {
    const rows = sheetToObjects("CLIENTES");
    // Coluna real é "WhatsApp" (não "Telefone") — antes lia chave errada => dedup nunca
    // casava e duplicava cliente a cada pedido. Compara por núcleo (DDD+8) p/ robustez.
    const jaExiste = rows.some(function(r) {
      return telCore(r["WhatsApp"]) === telCore(tel);
    });
    if (!jaExiste) {
      const sh = getSheet("CLIENTES");
      appendRowByHeaders("CLIENTES", {
        ID_Cliente: newId("CLI"), Nome: nome, WhatsApp: tel,
        Data_Cadastro: nowBR(), Score_Atual: 1000,
        Classificacao: "Novo", Origem_Contato: "Auto_Pedido"
      });
    }
  } catch(e) {
    Logger.log("autoRegistrarCliente: " + e);
  }
}

// ════════════════════════════════════════════════════════════════
// AUTH DE CLIENTE (G3) — senha hasheada + token HMAC sem estado
// Senha NUNCA em texto puro. Segredo do HMAC vive em Script Properties,
// fora do código e do Git. → [[ROADMAP-EVOLUCAO]] G3
// ════════════════════════════════════════════════════════════════
var _AUTH_COLS = ["Senha_Hash", "Salt", "Data_Senha"];

// Garante as colunas de auth na aba CLIENTES (idempotente).
function _ensureAuthCols() {
  const sh = getSheet("CLIENTES");
  if (!sh) throw new Error("Aba CLIENTES não encontrada");
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  _AUTH_COLS.forEach(function(col) {
    if (headers.indexOf(col) === -1) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
    }
  });
}

function _bytesToHex(bytes) {
  return bytes.map(function(b) { return (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"); }).join("");
}
function _genSalt() {
  return _bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(Math.random()) + Date.now() + Utilities.getUuid()));
}
function _hashSenha(senha, salt) {
  return _bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "::" + senha, Utilities.Charset.UTF_8));
}
function _authSecret() {
  const props = PropertiesService.getScriptProperties();
  var s = props.getProperty("AUTH_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); props.setProperty("AUTH_SECRET", s); }
  return s;
}
// token = base64url(payload) + "." + base64url(HMAC_SHA256(payload, secret))
// payload = telefone|expiraMs
function _signToken(telefone) {
  const exp = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 dias
  const payload = telCore(telefone) + "|" + exp;
  const sig = Utilities.computeHmacSha256Signature(payload, _authSecret());
  return Utilities.base64EncodeWebSafe(payload) + "." + Utilities.base64EncodeWebSafe(sig);
}
function _authTelefoneFromToken(token) {
  if (!token || token.indexOf(".") === -1) return null;
  try {
    const parts = token.split(".");
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    const expectSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, _authSecret()));
    if (expectSig !== parts[1]) return null;            // assinatura inválida (forjado)
    const seg = payload.split("|");
    if (Number(seg[1]) < Date.now()) return null;       // expirado
    return seg[0];                                       // = telCore(telefone)
  } catch (e) { return null; }
}

// Acha a linha do cliente por núcleo de telefone. Retorna {rowNum, obj, headers} ou null.
function _findClienteRow(telefone) {
  const sh = getSheet("CLIENTES");
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const iWpp = headers.indexOf("WhatsApp");
  if (iWpp === -1) return null;
  const alvo = telCore(telefone);
  for (var i = 1; i < data.length; i++) {
    if (telCore(data[i][iWpp]) === alvo) {
      const obj = {};
      headers.forEach(function(h, j) { if (h) obj[h] = data[i][j]; });
      return { rowNum: i + 1, obj: obj, headers: headers };
    }
  }
  return null;
}

function _setCelula(rowNum, header, valor) {
  const sh = getSheet("CLIENTES");
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const col = headers.indexOf(header);
  if (col >= 0) sh.getRange(rowNum, col + 1).setValue(valor);
}

function _validaSenha(s) {
  return typeof s === "string" && s.length >= 4 && s.length <= 64;
}

// Cadastro: telefone + senha (+ nome, foto opcional). Se já existe cliente (auto-registrado
// por pedido) sem senha, vincula a senha à linha existente. Se já tem senha, manda logar.
function cadastrarCliente(p) {
  try {
    var telefone = String((p && p.telefone) || "").replace(/\D/g, "");
    var senha = (p && p.senha) || "";
    var nome = String((p && p.nome) || "").trim();
    if (telCore(telefone).length < 10) return { ok: false, erro: "Telefone inválido (com DDD)" };
    if (!_validaSenha(senha)) return { ok: false, erro: "Senha deve ter entre 4 e 64 caracteres" };

    _ensureAuthCols();
    const salt = _genSalt();
    const hash = _hashSenha(senha, salt);

    var existente = _findClienteRow(telefone);
    if (existente) {
      if (existente.obj["Senha_Hash"]) return { ok: false, erro: "Telefone já cadastrado. Faça login.", jaCadastrado: true };
      _setCelula(existente.rowNum, "Senha_Hash", hash);
      _setCelula(existente.rowNum, "Salt", salt);
      _setCelula(existente.rowNum, "Data_Senha", nowBR());
      if (nome) _setCelula(existente.rowNum, "Nome", nome);
      var nomeFinal = nome || existente.obj["Nome"] || "";
      return { ok: true, token: _signToken(telefone), nome: nomeFinal };
    }

    // Cliente novo: cria linha respeitando a posição das colunas base + escreve auth por header
    appendRowByHeaders("CLIENTES", {
      ID_Cliente: newId("CLI"), Nome: nome, WhatsApp: telefone,
      Data_Cadastro: nowBR(), Score_Atual: 1000,
      Classificacao: "Novo", Origem_Contato: "Cadastro_Loja"
    });
    const novaRow = getSheet("CLIENTES").getLastRow();
    _setCelula(novaRow, "Senha_Hash", hash);
    _setCelula(novaRow, "Salt", salt);
    _setCelula(novaRow, "Data_Senha", nowBR());
    return { ok: true, token: _signToken(telefone), nome: nome };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// Login: telefone + senha. Compara hash. Sem revelar se o erro é telefone ou senha
// (mensagem genérica anti-enumeração).
function loginCliente(p) {
  try {
    var telefone = String((p && p.telefone) || "").replace(/\D/g, "");
    var senha = (p && p.senha) || "";
    if (!telefone || !senha) return { ok: false, erro: "Informe telefone e senha" };
    // N18: mesmo rate-limit do admin/operador — sem isso dava pra tentar senha à vontade contra
    // um telefone conhecido (login de cliente é público/anônimo, sem captcha)
    if (!_loginRateOk("cli_" + telefone)) return { ok: false, erro: "Muitas tentativas. Tente novamente em alguns minutos." };
    _ensureAuthCols();
    var cli = _findClienteRow(telefone);
    if (!cli || !cli.obj["Senha_Hash"]) { _loginRateHit("cli_" + telefone); return { ok: false, erro: "Telefone ou senha incorretos" }; }
    var hash = _hashSenha(senha, cli.obj["Salt"]);
    if (hash !== cli.obj["Senha_Hash"]) { _loginRateHit("cli_" + telefone); return { ok: false, erro: "Telefone ou senha incorretos" }; }
    _loginRateClear("cli_" + telefone);
    return { ok: true, token: _signToken(telefone), nome: cli.obj["Nome"] || "" };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// Checa se um telefone já tem cadastro (com senha). Usado no front antes de cadastrar.
// Não revela dados pessoais — só flags.
function verificarCliente(p) {
  try {
    var telefone = String((p && p.telefone) || "").replace(/\D/g, "");
    if (telCore(telefone).length < 10) return { ok: false, erro: "Telefone inválido" };
    var cli = _findClienteRow(telefone);
    return { ok: true, existe: !!cli, temSenha: !!(cli && cli.obj["Senha_Hash"]) };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

// Gate de admin: confere p.adminSenha contra ADMIN_SENHA (Script Properties > Config).
function _checkAdmin(p) {
  const correta = PropertiesService.getScriptProperties().getProperty("ADMIN_SENHA")
               || getConfigValue("ADMIN_SENHA");
  return !!correta && String((p && p.adminSenha) || "") === String(correta);
}

// Admin redefine a senha de um cliente (cliente pede via WhatsApp). Hash irreversível,
// então não há "revelar" — só resetar. Gera salt+hash novos.
function resetarSenhaCliente(p) {
  try {
    if (!_checkAdmin(p)) return { ok: false, erro: "Não autorizado" };
    var telefone = String((p && p.telefone) || "").replace(/\D/g, "");
    var novaSenha = (p && p.novaSenha) || "";
    if (telCore(telefone).length < 10) return { ok: false, erro: "Telefone inválido" };
    if (!_validaSenha(novaSenha)) return { ok: false, erro: "Senha deve ter entre 4 e 64 caracteres" };
    _ensureAuthCols();
    var cli = _findClienteRow(telefone);
    if (!cli) return { ok: false, erro: "Cliente não encontrado" };
    var salt = _genSalt();
    _setCelula(cli.rowNum, "Senha_Hash", _hashSenha(novaSenha, salt));
    _setCelula(cli.rowNum, "Salt", salt);
    _setCelula(cli.rowNum, "Data_Senha", nowBR());
    return { ok: true, nome: cli.obj["Nome"] || "" };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}


// \u2500\u2500 HELPERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getSheet(name) { return SS.getSheetByName(name); }

// D1: append por NOME de coluna — adicionar/remover coluna na aba não corrompe a linha.
// obj = { Header: valor }. Retorna o array montado na ordem dos headers atuais.
function appendRowByHeaders(sheetName, obj) {
  const sh = getSheet(sheetName);
  if (!sh) throw new Error("Aba " + sheetName + " não encontrada");
  const headers = getHeaders(sheetName);
  const row = headers.map(function(h) { return obj[h] !== undefined ? obj[h] : ""; });
  sh.appendRow(row);
  return row;
}

// Escapa HTML para evitar injeção em comprovantes/e-mails gerados com dados do usuário.
function escapeHTML(s) {
  return String(s === undefined || s === null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sheetToObjects(name) {
  const sh = getSheet(name);
  if (!sh) return [];
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { if (h) obj[h] = row[i]; });
    if (obj["ID"] !== undefined && obj["ID"] !== "") obj["ID"] = String(obj["ID"]);
    return obj;
  });
}

function getHeaders(name) {
  const sh = getSheet(name);
  if (!sh) return [];
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].filter(h => h !== "");
}

function corrigirHeaders() {
  const sheets = {
    Pedidos: ["ID Pedido","Data/Hora","Nome Cliente","Telefone","Itens (JSON)","Subtotal (R$)","Cupom","Desconto (R$)","tipoFrete","valorFrete","Total (R$)","Forma Pagamento","Status","Observações","Data_Vencimento","ID_Evento_Agenda_Cobranca","Fornecedor_Selecionado","Custo_Lote","Data_Finalizacao","ID_Evento_Agenda_Status","Data_Criacao","Data_Confirmacao","Qtd_Parcelas","Intervalo_Dias","Responsavel","Endereco","CEP","Data_Acordada","Data_Lembrete"],
    "Financeiro_Fluxo": ["ID_Baixa","ID_Pedido","Nome_Cliente","Valor_Original","Status_Pagamento","Dias_Atraso","Taxa_Aplicada_RS","Valor_Final_Recebido","Data_Baixa_Efetiva","Saldo_Restante","Proxima_Vencimento","Telefone","Forma_Pagamento"],
    CLIENTES: ["ID_Cliente","Nome","WhatsApp","Email","CPF_CNPJ","Endereco","CEP","Cidade","Estado","Data_Cadastro","Score_Atual","Compras_No_Prazo","Compras_Com_Atraso","Compras_Adiantadas","Total_Gasto_RS","Classificacao","Origem_Contato","Senha_Hash","Salt","Data_Senha"],
    Produtos: ["ID","Nome do Produto","Preço","Estoque","Status","Categoria","Descrição","Imagens"],
    Config: ["Chave","Valor","Descricao"],
    Acessos_Log: ["Data_Hora","ID_Produto","Tipo_Acao"],
    CARRINHOS_ABANDONADOS: ["Data_Hora","Nome","Telefone","Itens","Total_RS"]
  };
  const corrigidos = [];
  for (var nome in sheets) {
    var sh = getSheet(nome);
    if (!sh) continue;
    var esperados = sheets[nome];
    var ultCol = sh.getLastColumn();
    if (ultCol === 0) {
      sh.getRange(1, 1, 1, esperados.length).setValues([esperados]);
      corrigidos.push(nome + " (vazia, cabeçalho inserido)");
      continue;
    }
    var row1 = sh.getRange(1, 1, 1, Math.max(ultCol, esperados.length)).getValues()[0];
    var edits = [];
    for (var i = 0; i < esperados.length; i++) {
      var val = String(row1[i] || "").trim();
      if (!val) edits.push(i + 1);
    }
    if (edits.length > 0) {
      for (var j = 0; j < edits.length; j++) {
        sh.getRange(1, edits[j]).setValue(esperados[edits[j] - 1]);
      }
      corrigidos.push(nome + " (preenchidos cabeçalhos: colunas " + edits.join(", ") + ")");
    }
  }
  return { ok: true, corrigidos: corrigidos };
}

// colIdx pode ser número (posição 0-based) ou NOME de coluna (resolve via headers).
function findRow(sheetName, colIdx, val) {
  const sh = getSheet(sheetName);
  if (!sh) return null;
  const data = sh.getDataRange().getValues();
  let idx = colIdx;
  if (typeof colIdx === "string") {
    idx = data[0].indexOf(colIdx);
    if (idx < 0) return null;
  }
  const sv = String(val);
  const svNum = sv.replace(/^P/, "");
  for (let i = 1; i < data.length; i++) {
    const cell = String(data[i][idx]);
    if (cell === sv || cell === svNum || String(Number(cell)) === svNum) return { sh, rowNum: i + 1, row: data[i] };
  }
  return null;
}

function newId(prefix) { return prefix + Date.now(); }

// \u2500\u2500 NORMALIZAÇÃO DE DATA SERIAL (BUG-01) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function normalizarDataHora(val) {
  if (!val) return "";
  // Date object (Google Sheets native date value)
  if (val instanceof Date) {
    return Utilities.formatDate(val, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  }
  const s = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s;
  const n = Number(s.replace(",", "."));
  if (!isNaN(n) && n > 40000) {
    const base = new Date(1899, 11, 30);
    const dias = Math.floor(n);
    const frac = n - dias;
    const ms = Math.round(frac * 86400000);
    const d = new Date(base.getTime() + dias * 86400000 + ms);
    return Utilities.formatDate(d, "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
  }
  return s;
}

function safeNum(v) {
  if (!v && v !== 0) return 0;
  var n = Number(v);
  if (!isNaN(n)) return n;
  var s = String(v).replace(/\./g, "").replace(",", ".");
  var n2 = Number(s);
  return isNaN(n2) ? 0 : n2;
}

// \u2500\u2500 ID CURTO PARA PEDIDOS (BUG-07) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// X3/A2/A3 (2026-08-03): 5 chars (33^5≈39M) tinha entropia baixa pro volume crescendo, recursão sem
// limite arriscava stack overflow em caso raro de colisões seguidas, e lia a planilha INTEIRA a cada
// tentativa. Agora: 7 chars (33^7≈42 bilhões), loop com limite de 10 tentativas + fallback determinístico
// (timestamp+rand), e lê a planilha 1x só fora do loop.
function newPedidoId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const existing = sheetToObjects("Pedidos").map(function(p) { return p["ID Pedido"]; });
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    let id = "";
    for (let i = 0; i < 7; i++) id += chars[Math.floor(Math.random() * chars.length)];
    if (existing.indexOf(id) === -1) return id;
  }
  // Fallback determinístico — praticamente impossível de colidir, garante que sempre retorna algo
  return "P" + Date.now().toString(36).toUpperCase() + chars[Math.floor(Math.random() * chars.length)];
}

function nowBR() {
  return Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy HH:mm");
}

function getConfigValue(key) {
  const sh = getSheet("Config");
  if (!sh) return "";
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === key) return String(data[i][1]);
  }
  return "";
}

// Parseia data no formato dd/MM/yyyy para objeto Date
function parseDateBR(str) {
  if (!str) return null;
  const s = String(str).trim();
  const parts = s.split("/");
  if (parts.length === 3) {
    const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    if (!isNaN(d.getTime())) return d;
  }
  // Tenta formato ISO
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;
  return null;
}

// \u2500\u2500 SETUP: Cria abas e colunas novas se não existirem \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setupSheets() {
  const created = [];

  // Financeiro_Fluxo
  if (!getSheet("Financeiro_Fluxo")) {
    const sh = SS.insertSheet("Financeiro_Fluxo");
    sh.getRange(1, 1, 1, 13).setValues([[
      "ID_Baixa", "ID_Pedido", "Nome_Cliente", "Valor_Original",
      "Status_Pagamento", "Dias_Atraso", "Taxa_Aplicada_RS",
      "Valor_Final_Recebido", "Data_Baixa_Efetiva",
      "Saldo_Restante", "Proxima_Vencimento", "Telefone", "Forma_Pagamento"
    ]]);
    created.push("Financeiro_Fluxo");
  } else {
    // Adiciona colunas novas se Financeiro_Fluxo já existir
    const finSh = getSheet("Financeiro_Fluxo");
    const finHeaders = finSh.getRange(1, 1, 1, finSh.getLastColumn()).getValues()[0];
    ["Telefone", "Saldo_Restante", "Proxima_Vencimento", "Forma_Pagamento"].forEach(col => {
      if (!finHeaders.includes(col)) {
        finSh.getRange(1, finSh.getLastColumn() + 1).setValue(col);
        created.push("Financeiro_Fluxo." + col);
      }
    });
  }

  // Acessos_Log
  if (!getSheet("Acessos_Log")) {
    const sh = SS.insertSheet("Acessos_Log");
    sh.getRange(1, 1, 1, 3).setValues([["Data_Hora", "ID_Produto", "Tipo_Acao"]]);
    created.push("Acessos_Log");
  }

  // Adiciona colunas novas em Produtos se não existirem
  const prodSh = getSheet("Produtos");
  if (prodSh) {
    const prodHeaders = prodSh.getRange(1, 1, 1, prodSh.getLastColumn()).getValues()[0];
    const novasProd = ["Fornecedores_JSON", "Garantia_Padrao", "Tags_Personalizadas"];
    novasProd.forEach(col => {
      if (!prodHeaders.includes(col)) {
        const nextCol = prodSh.getLastColumn() + 1;
        prodSh.getRange(1, nextCol).setValue(col);
        created.push("Produtos." + col);
      }
    });
  }

  // Adiciona colunas novas em Pedidos se não existirem
  const pedSh = getSheet("Pedidos");
  if (pedSh) {
    const headers = pedSh.getRange(1, 1, 1, pedSh.getLastColumn()).getValues()[0];
    const novas = [
      "ID_Evento_Agenda_Status",
      "ID_Evento_Agenda_Cobranca",
      "Data_Criacao",
      "Data_Confirmacao",
      "Data_Finalizacao",
      "Fornecedor_Selecionado",
      "Custo_Lote",
      "Data_Vencimento",
      "Qtd_Parcelas",
      "Intervalo_Dias",
      "Responsavel",
      "Endereco",
      "CEP",
      "Data_Acordada",
      "Data_Lembrete"
    ];
    novas.forEach(col => {
      if (!headers.includes(col)) {
        const nextCol = pedSh.getLastColumn() + 1;
        pedSh.getRange(1, nextCol).setValue(col);
        created.push("Pedidos." + col);
      }
    });
  }

  // Adiciona chaves novas em Config
  const cfgSh = getSheet("Config");
  if (cfgSh) {
    const cfgData = cfgSh.getDataRange().getValues();
    const keys = cfgData.map(r => r[0]);
    const novasChaves = [
      ["TAXA_ATRASO_PADRAO_DIARIA_PERCENTUAL", "0.33", "Juros diários em % para atrasos"],
      ["RECORRENCIA_ALERTA_DIAS", "45", "Dias sem compra para alertar cliente sumido"],
      ["EXIBIR_PRODUTOS_RECENTES", "SIM", "Exibir seção de produtos recém chegados"],
      ["EMAIL_NOTIFICACAO", "", "Email para notificações de novos pedidos"],
      ["TERMO_GARANTIA_GLOBAL", "90 dias contra defeitos de fabricação", "Garantia padrão para recibos"],
      ["EXIBIR_GRAFICO_LUCRO", "SIM", "Exibir gráfico de lucro no admin"],
      ["SLA_PENDENTE_HORAS", "24", "Horas para responder pedido Pendente antes de alertar"],
      ["SLA_ANDAMENTO_HORAS", "24", "Horas para concluir pedido Em Andamento antes de alertar"],
      ["FORMAS_PAGAMENTO", "PIX,Cartão,Parcelado GJ,Dinheiro,Boleto", "Formas de pagamento disponíveis (separadas por vírgula)"],
      ["NOME_LOJA", "GJ Store", "Nome da loja exibido nos cabeçalhos e título"],
      ["COR_PRIMARIA_HEX", "#00e676", "Cor principal (botões, destaques) \u2014 white-label"],
      ["COR_SECUNDARIA_HEX", "#00bcd4", "Cor secundária (bordas, ícones) \u2014 white-label"],
      ["COR_FUNDO_HEX", "#04090f", "Cor de fundo do tema escuro \u2014 white-label"],
      ["COR_TEXTO_HEX", "#e2f4ff", "Cor do texto principal \u2014 white-label"],
      ["LOGO_URL", "", "URL da logo da loja (opcional)"],
      ["WHATSAPP_LOJA", "5521970363062", "Número WhatsApp da loja para links wa.me"],
      ["TERMOS_GARANTIA", "90 dias contra defeitos de fabricação", "Texto padrão de garantia em recibos"],
      ["META_MENSAL_RS", "5000", "Meta de faturamento mensal em R$ para barra de progresso"],
      ["DESCONTO_REENGAJAMENTO_PORCENTO", "10", "Desconto % para cupons automáticos de reengajamento"],
      ["CUSTO_UNITARIO_PADRAO", "0", "Custo unitário padrão para produtos sem custo definido"]
    ];
    novasChaves.forEach(([k, v, d]) => {
      if (!keys.includes(k)) {
        appendRowByHeaders("Config", { Chave: k, Valor: v, Descricao: d });
        created.push("Config." + k);
      }    });
  }

  return { ok: true, created };
}

// \u2500\u2500 CONFIG \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getConfig() {
  const rows = sheetToObjects("Config");
  const cfg = {};
  rows.forEach(r => { cfg[r["Chave"]] = r["Valor"]; });
  delete cfg["ADMIN_SENHA"];
  return { config: cfg };
}

// \u2500\u2500 DESTAQUES (G5.1) \u2500\u2500 conte\u00fado configur\u00e1vel na home (produto/v\u00eddeo/promo) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _ensureDestaquesSheet() {
  let sh = getSheet("Destaques");
  if (!sh) {
    sh = SS.insertSheet("Destaques");
    sh.getRange(1, 1, 1, 7).setValues([["ID", "Tipo", "Ref", "Texto", "Data_Inicio", "Data_Fim", "Ativo"]]);
    sh.setFrozenRows(1);
  }
  return sh;
}
function getDestaques() {
  _ensureDestaquesSheet();
  return { ok: true, destaques: sheetToObjects("Destaques") };
}
// Destaque ativo agora: Ativo=Sim e dentro do per\u00edodo (se datas preenchidas).
// Tipo=Produto j\u00e1 vem com o produto embutido pro front n\u00e3o precisar de 2\u00aa chamada.
function getDestaqueAtivo() {
  const rows = sheetToObjects("Destaques");
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const ativo = rows.find(function(r) {
    if (String(r["Ativo"] || "").trim().toLowerCase() !== "sim") return false;
    const iniStr = r["Data_Inicio"] ? normalizarDataHora(r["Data_Inicio"]).split(" ")[0] : "";
    const fimStr = r["Data_Fim"] ? normalizarDataHora(r["Data_Fim"]).split(" ")[0] : "";
    const ini = iniStr ? parseDateBR(iniStr) : null;
    const fim = fimStr ? parseDateBR(fimStr) : null;
    if (ini && hoje < ini) return false;
    if (fim) { const fimEnd = new Date(fim); fimEnd.setHours(23, 59, 59, 999); if (hoje > fimEnd) return false; }
    return true;
  });
  if (!ativo) return { destaque: null };
  const out = { id: ativo["ID"] || "", tipo: ativo["Tipo"] || "", ref: ativo["Ref"] || "", texto: ativo["Texto"] || "" };
  if (String(ativo["Tipo"]).toLowerCase() === "produto") {
    const prods = sheetToObjects("Produtos");
    const prod = prods.find(function(p) { return String(p["ID"]) === String(ativo["Ref"]); });
    if (prod) out.produto = prod;
  }
  return { destaque: out };
}
function salvarDestaque(p) {
  _ensureDestaquesSheet();
  const isNovo = !p.id;
  const id = p.id || ("DEST" + Date.now());
  const obj = { ID: id, Tipo: p.tipo || "", Ref: p.ref || "", Texto: p.texto || "", Data_Inicio: p.dataInicio || "", Data_Fim: p.dataFim || "", Ativo: p.ativo || "N\u00e3o" };
  if (!isNovo) {
    const found = findRow("Destaques", 0, id);
    if (found) {
      const headers = getHeaders("Destaques");
      headers.forEach(function(h, i) { found.sh.getRange(found.rowNum, i + 1).setValue(obj[h] !== undefined ? obj[h] : ""); });
      return { ok: true, id: id };
    }
  }
  appendRowByHeaders("Destaques", obj);
  return { ok: true, id: id };
}
function deletarDestaque(id) {
  const found = findRow("Destaques", 0, id);
  if (!found) return { ok: false, error: "Destaque n\u00e3o encontrado" };
  found.sh.deleteRow(found.rowNum);
  return { ok: true };
}

// \u2500\u2500 BANNERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getBanners() {
  const rows = sheetToObjects("Banners");
  const ativos = rows
    .filter(r => String(r["Ativo?"]).toLowerCase() === "sim")
    .sort((a, b) => Number(a["Ordem"]) - Number(b["Ordem"]));
  return { banners: ativos };
}

// \u2500\u2500 PRODUTOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _normCat(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}
function getProdutos(p) {
  const cache = CacheService.getScriptCache();
  const isAll = p.verTodos === "1";
  const catKey = (p.categoria && p.categoria !== "todos") ? _normCat(p.categoria) : "";
  const searchKey = p.busca || "";
  const cacheKey = !isAll && catKey && !searchKey && p.recentes !== "1" ? "cat_" + catKey + "_v3" : null;
  const offset = Number(p.offset) || 0;
  const limit = Number(p.limit) || 0;
  // Tenta cache do CacheService
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const data = JSON.parse(cached);
        let list = data.produtos;
        // Só usa cache se temos dados suficientes para o offset pedido
        if (offset < list.length) {
          if (offset) list = list.slice(offset);
          if (limit) list = list.slice(0, limit);
          return { produtos: list, total: data.total };
        }
        // Offset além do cacheado → reler planilha abaixo
      } catch(e) { console.error("getProdutos cache parse: " + e.message); }
    }
  }
  // Usa cache de script (evita reler planilha na mesma execução)
  if (!_PROD_ROWS) _PROD_ROWS = sheetToObjects("Produtos");
  const rows = _PROD_ROWS;
  let list = rows.map(function(r) {
    const est = r["Estoque"];
    return Object.assign({}, r, {
      "Estoque": (est !== "" && est !== undefined && est !== null) ? Number(est) : null
    });
  });
  if (p.verTodos !== "1") {
    list = list.filter(r => String(r["Status"]).toLowerCase() === "ativo");
    if (p.verRascunhos !== "1") {
      list = list.filter(r => {
        const pub = String(r["Publicado"] || "").trim().toLowerCase();
        return pub === "" || pub === "sim";
      });
    }
  }
  if (catKey) {
    list = list.filter(r => _normCat(r["Categoria"]) === catKey);
  }
  if (searchKey) {
    const q = searchKey.toLowerCase();
    list = list.filter(r =>
      String(r["Nome do Produto"]).toLowerCase().includes(q) ||
      String(r["Descrição"]).toLowerCase().includes(q)
    );
  }
  if (p.recentes === "1") {
    const exibir = getConfigValue("EXIBIR_PRODUTOS_RECENTES");
    if (exibir === "SIM") {
      const recentes = list.slice(-8).reverse();
      return { produtos: recentes, total: recentes.length };
    }
  }
  const total = list.length;
  // Salva no CacheService: no máximo 140 produtos (~84KB, CacheService tem limite de 100KB por item)
  if (cacheKey) {
    try {
      var toCache = list.length > 140 ? list.slice(0, 140) : list;
      cache.put(cacheKey, JSON.stringify({ produtos: toCache, total: total }), 300);
      _regCatKey(cache, cacheKey);
    } catch(e) { console.error("getProdutos cache put: " + e.message); }
  }
  if (offset) list = list.slice(offset);
  if (limit) list = list.slice(0, limit);
  return { produtos: list, total };
}

function salvarProduto(p) {
  const sh = getSheet("Produtos");
  const headers = getHeaders("Produtos");
  const id = p.id || p["ID"] || "";
  const row = headers.map(h => {
    if (h === "ID" && !id) return newId("P");
    if (p[h] !== undefined) return p[h];
    return "";
  });
  if (id) {
    const found = findRow("Produtos", 0, id);
    if (found) {
      sh.getRange(found.rowNum, 1, 1, row.length).setValues([row]);
      SpreadsheetApp.flush();
      _clearProdCache();
      return { ok: true, action: "updated", id };
    }
  }
  sh.appendRow(row);
  SpreadsheetApp.flush();
  _clearProdCache();
  return { ok: true, action: "created", id: row[0] };
}

function deletarProduto(id) {
  const found = findRow("Produtos", 0, id);
  if (!found) return { error: "Produto não encontrado" };
  const headers = getHeaders("Produtos");
  const col = headers.indexOf("Status") + 1;
  found.sh.getRange(found.rowNum, col).setValue("Inativo");
  _clearProdCache();
  return { ok: true };
}

function _clearProdCache() {
  _PROD_ROWS = null;
  try {
    const cache = CacheService.getScriptCache();
    // CacheService não tem getAllKeys() — usa registry próprio
    var reg = [];
    try { reg = JSON.parse(cache.get("cat_keys_reg") || "[]"); } catch(e) { console.error("cat_keys_reg parse: " + e.message); }
    if (reg.length) cache.removeAll(reg);
    cache.remove("cat_keys_reg");
  } catch(e) {}
}

function _regCatKey(cache, key) {
  try {
    var reg = [];
    try { reg = JSON.parse(cache.get("cat_keys_reg") || "[]"); } catch(e) { console.error("cat_keys_reg parse: " + e.message); }
    if (!reg.includes(key)) { reg.push(key); cache.put("cat_keys_reg", JSON.stringify(reg), 310); }
  } catch(e) {}
}

// Adiciona colunas extras em Produtos sem apagar dados existentes
function addColunasProdutos() {
  const sh = getSheet("Produtos");
  if (!sh) return { ok: false, erro: "Aba Produtos não encontrada" };
  const headers = getHeaders("Produtos");
  const extras = ["Custo_Unitario", "Publicado", "Data_Cadastro"];
  const added = [];
  extras.forEach(function(col) {
    if (!headers.includes(col)) {
      const nextCol = sh.getLastColumn() + 1;
      sh.getRange(1, nextCol).setValue(col);
      added.push(col);
    }
  });
  return { ok: true, adicionadas: added, jaExistiam: extras.filter(function(c) { return !added.includes(c); }) };
}

function deduplicarProdutos() {
  var sh = getSheet("Produtos");
  var data = sh.getDataRange().getValues();
  var seen = {};
  var toDelete = [];
  // varre de baixo pra cima: mantém a ÚLTIMA ocorrência de cada ID
  for (var i = data.length - 1; i >= 1; i--) {
    var id = String(data[i][0]).trim();
    if (!id) continue;
    if (seen[id]) {
      toDelete.push(i + 1); // rowNum (1-based)
    } else {
      seen[id] = true;
    }
  }
  // deleta de baixo pra cima para não deslocar índices
  toDelete.sort(function(a, b) { return b - a; });
  toDelete.forEach(function(r) { sh.deleteRow(r); });
  _clearProdCache();
  return { ok: true, removidos: toDelete.length };
}

// Deduplica por nome dentro de uma categoria, mantendo o produto com mais imagens
// Prefer eslbyl14 images (nova conta) over dxffbx07d (antiga). Deleta o resto físicamente.
function deduplicarPorNome(p) {
  var categoria = p.categoria || "Perfumes";
  var sh = getSheet("Produtos");
  if (!sh) return { error: "Aba Produtos não encontrada" };
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idIdx    = headers.indexOf("ID");
  var nomeIdx  = headers.indexOf("Nome do Produto");
  var catIdx   = headers.indexOf("Categoria");
  var img1Idx  = headers.indexOf("Imagem 1 (URL)");
  var img2Idx  = headers.indexOf("Imagem 2 (URL)");
  var img3Idx  = headers.indexOf("Imagem 3 (URL)");
  if (idIdx < 0 || nomeIdx < 0) return { error: "Colunas ID / Nome do Produto não encontradas" };

  // Agrupa por nome dentro da categoria
  var byName = {};
  for (var i = 1; i < data.length; i++) {
    var cat = String(data[i][catIdx] || "").trim();
    if (cat !== categoria) continue;
    var nome = String(data[i][nomeIdx] || "").trim().toUpperCase();
    if (!nome) continue;
    if (!byName[nome]) byName[nome] = [];
    byName[nome].push({ rowIdx: i, row: data[i] });
  }

  // Pontuação: conta imagens e prefere eslbyl14
  function imgScore(row) {
    var score = 0;
    [img1Idx, img2Idx, img3Idx].forEach(function(idx) {
      if (idx < 0) return;
      var url = String(row[idx] || "");
      if (!url) return;
      score += url.includes("eslbyl14") ? 3 : 1;
    });
    return score;
  }

  // Para cada grupo com duplicatas, elege o melhor e coleta rowNums a deletar (de baixo pra cima)
  var toDelete = [];
  var kept = [], removed = [];
  for (var nome in byName) {
    var group = byName[nome];
    if (group.length < 2) continue;
    // ordena: maior score primeiro; empate → rowIdx menor (produto mais antigo) primeiro
    group.sort(function(a, b) {
      var sd = imgScore(b.row) - imgScore(a.row);
      return sd !== 0 ? sd : a.rowIdx - b.rowIdx;
    });
    var winner = group[0];
    kept.push(String(winner.row[idIdx]));
    for (var j = 1; j < group.length; j++) {
      toDelete.push(group[j].rowIdx + 1); // 1-based rowNum
      removed.push(String(group[j].row[idIdx]));
    }
  }

  // Deleta de baixo pra cima para não deslocar índices
  toDelete.sort(function(a, b) { return b - a; });
  toDelete.forEach(function(rowNum) { sh.deleteRow(rowNum); });
  _clearProdCache();
  return { ok: true, categoria: categoria, removidos: removed.length, kept: kept, removed: removed };
}

// Simula salvarProduto SEM escrever — retorna o que seria escrito e o que está na planilha
// Escreve "__TESTE__" no nome do produto P8479, lê de volta, restaura original
function testarEscrita(p) {
  var testId = p.id || "P8479";
  var sh = getSheet("Produtos");
  if (!sh) return { error: "Aba Produtos não encontrada" };
  var found = findRow("Produtos", 0, testId);
  if (!found) return { error: "ID " + testId + " não encontrado", findRowResult: null };
  var headers = getHeaders("Produtos");
  var nomeIdx = headers.indexOf("Nome do Produto");
  if (nomeIdx < 0) return { error: "Coluna 'Nome do Produto' não encontrada" };
  // Lê valor original
  var nomeColCell = sh.getRange(found.rowNum, nomeIdx + 1);
  var original = nomeColCell.getValue();
  // Escreve teste
  var testValue = "__TESTE_" + Date.now() + "__";
  nomeColCell.setValue(testValue);
  SpreadsheetApp.flush(); // força commit imediato
  // Lê de volta para confirmar
  var confirmRead = sh.getRange(found.rowNum, nomeIdx + 1).getValue();
  // Restaura original
  nomeColCell.setValue(original);
  SpreadsheetApp.flush();
  return {
    ok: true,
    testId: testId,
    rowNum: found.rowNum,
    original: original,
    testValue: testValue,
    confirmRead: confirmRead,
    writeSucceeded: confirmRead === testValue,
    restored: true
  };
}

function debugSalvar(p) {
  var sh = getSheet("Produtos");
  if (!sh) return { error: "Aba Produtos não encontrada" };
  var headers = getHeaders("Produtos");
  var id = p.id || p["ID"] || "";
  var row = headers.map(function(h) {
    if (h === "ID" && !id) return "(new)";
    if (p[h] !== undefined) return p[h];
    return "(blank)";
  });
  var found = id ? findRow("Produtos", 0, id) : null;
  var currentRow = null;
  if (found) currentRow = found.row.slice(0, headers.length);
  return {
    ok: true,
    id: id,
    headers: headers,
    rowToWrite: row,
    findRowResult: found ? { rowNum: found.rowNum } : null,
    currentRowInSheet: currentRow,
    paramsReceived: Object.keys(p)
  };
}

function debugFindRow(p) {
  var id = String(p.id || "");
  var sh = getSheet("Produtos");
  if (!sh) return { error: "Aba Produtos não encontrada" };
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var sv = id;
  var svNum = sv.replace(/^P/, "");
  var col0Samples = [];
  for (var i = 1; i < Math.min(data.length, 20); i++) {
    var cell = data[i][0];
    col0Samples.push({ row: i + 1, raw: cell, type: typeof cell, str: String(cell) });
  }
  // busca exata
  var found = null;
  for (var i = 1; i < data.length; i++) {
    var cell = String(data[i][0]);
    if (cell === sv || cell === svNum || String(Number(cell)) === svNum) {
      found = { rowNum: i + 1, cell: data[i][0], cellStr: String(data[i][0]) };
      break;
    }
  }
  return {
    ok: true,
    searchId: id,
    sv: sv,
    svNum: svNum,
    totalRows: data.length - 1,
    headers: headers.slice(0, 5),
    col0Samples: col0Samples,
    found: found
  };
}

function fixarIDsVazios() {
  const sh = getSheet("Produtos");
  if (!sh) return { ok: false, erro: "Aba Produtos não encontrada" };
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const idColIdx = headers.indexOf("ID");
  if (idColIdx < 0) return { ok: false, erro: "Coluna ID não encontrada" };
  var baseTs = Date.now();
  var updates = []; // { rowNum, newId }
  for (var i = 1; i < data.length; i++) {
    var id = String(data[i][idColIdx]).trim();
    if (!id) updates.push({ rowNum: i + 1, newId: "P" + (baseTs + updates.length) });
  }
  // Batch write — evita timeout por setValue individual
  updates.forEach(function(u) {
    sh.getRange(u.rowNum, idColIdx + 1).setValue(u.newId);
  });
  _clearProdCache();
  return { ok: true, fixed: updates.length };
}

// X7: backup genérico antes de exclusão física — mesmo padrão de _Lixeira_Pedidos/_Lixeira_Financeiro,
// generalizado pra qualquer aba. Sem isso, exclusão de produto era irreversível e sem rastro nenhum.
function _backupLinha(lixeiraName, headers, row) {
  try {
    let lix = SS.getSheetByName(lixeiraName);
    if (!lix) {
      lix = SS.insertSheet(lixeiraName);
      lix.getRange(1, 1, 1, headers.length + 1).setValues([["_Excluido_Em", ...headers]]);
      lix.setFrozenRows(1);
    }
    lix.appendRow([nowBR(), ...row]);
  } catch (e) { console.warn("_backupLinha " + lixeiraName + ": " + e.message); }
}
function excluirProdutoHard(p) {
  if (!_checkAdmin(p)) return { ok: false, erro: "Não autorizado" };
  const id = String(p.id || "");
  const headers = getHeaders("Produtos");
  if (!id) {
    // Delete rows without ID by name match (for cleanup)
    const name = String(p.nome || "").trim();
    if (!name) return { ok: false, erro: "ID ou nome obrigatório" };
    const sh = getSheet("Produtos");
    const data = sh.getDataRange().getValues();
    let deleted = 0;
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim() === "" && String(data[i][1] || "").trim().toUpperCase() === name.toUpperCase()) {
        _backupLinha("_Lixeira_Produtos", headers, data[i]);
        sh.deleteRow(i + 1);
        deleted++;
      }
    }
    _clearProdCache();
    return { ok: true, deleted };
  }
  const found = findRow("Produtos", 0, id);
  if (!found) return { ok: false, erro: "Produto não encontrado" };
  _backupLinha("_Lixeira_Produtos", headers, found.row);
  found.sh.deleteRow(found.rowNum);
  _clearProdCache();
  return { ok: true, deleted: 1 };
}

function deletarPedido(id) {
  const found = findRow("Pedidos", 0, id);
  if (!found) return { error: "Pedido não encontrado" };
  const headers = getHeaders("Pedidos");
  const col = headers.indexOf("Status") + 1;
  if (col < 1) return { error: "Coluna Status não encontrada" };
  found.sh.getRange(found.rowNum, col).setValue("Deletado");
  return { ok: true };
}

// ── E1.2: AUDITORIA (Log_Acoes — quem/quando/oquê; separado de Logs_Metricas) ──
function registrarAcao(operador, acao, entidade, ref, detalhe) {
  try {
    let sh = SS.getSheetByName("Log_Acoes");
    if (!sh) {
      sh = SS.insertSheet("Log_Acoes");
      sh.getRange(1, 1, 1, 6).setValues([["Timestamp", "Operador", "Acao", "Entidade", "ID_Ref", "Detalhe"]]);
      sh.setFrozenRows(1);
    }
    appendRowByHeaders("Log_Acoes", {
      Timestamp: nowBR(), Operador: String(operador || "—"), Acao: String(acao || ""),
      Entidade: String(entidade || ""), ID_Ref: String(ref || ""), Detalhe: String(detalhe || "")
    });
  } catch (e) { /* auditoria nunca derruba a operação */ }
}

function getLogAcoes(p) {
  const rows = sheetToObjects("Log_Acoes") || [];
  const lim = Number((p && p.limite) || 300);
  return { ok: true, logs: rows.slice(-lim).reverse() };
}

// ── E1.1 + E1.5: EXCLUSÃO REAL (linha some da aba; backup em _Lixeira_*) ──
// E4.2: painel de cobrança — quem tá pra vencer / atrasado, ordenado por urgência
// E4.3: itens do pedido resumidos (JSON+pipe) — usado na msg de cobrança personalizada
function _itensResumo(raw) {
  raw = raw || "";
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr) && arr.length) {
      return arr.map(function(i) { return (i.nome || i.name || "?") + ((i.qtd || i.qty || 1) > 1 ? " x" + (i.qtd || i.qty) : ""); }).join(", ");
    }
  } catch (e) {}
  return String(raw).split("|").filter(Boolean).map(function(s) { return s.trim(); }).join(", ");
}

function getCobrancasPendentes() {
  try {
    const baixas = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];
    const pendentes = baixas.filter(function(b) { return String(b["Status_Pagamento"] || "") === "Pendente"; });
    const pedidosMap = {};
    sheetToObjects("Pedidos").forEach(function(pd) { pedidosMap[String(pd["ID Pedido"] || "")] = pd; });
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const itens = pendentes.map(function(b) {
      const dvNorm = normalizarDataHora(b["Proxima_Vencimento"]);
      const dv = dvNorm ? parseDateBR(dvNorm.split(" ")[0]) : null;
      if (dv) dv.setHours(0, 0, 0, 0);
      const diff = dv ? Math.round((dv - hoje) / 86400000) : null; // negativo = atrasado
      const diasAtraso = diff !== null && diff < 0 ? -diff : 0;
      const pd = pedidosMap[String(b["ID_Pedido"] || "")];
      return {
        idPedido: b["ID_Pedido"] || "",
        nome: b["Nome_Cliente"] || "",
        telefone: b["Telefone"] || "",
        itens: pd ? _itensResumo(pd["Itens (JSON)"] || pd["Itens"]) : "",
        valor: Number(b["Saldo_Restante"] || b["Valor_Original"] || 0),
        vencimento: dvNorm ? dvNorm.split(" ")[0] : "",
        diasAtraso: diasAtraso,
        diasRestantes: diff !== null && diff >= 0 ? diff : null,
        jurosEstimado: diasAtraso * 5, // regra R$5/dia (decisions.md) — estimativa exibida, aplicado de fato só na baixa
        urgencia: diff === null ? "sem_data" : diff < 0 ? "atrasado" : diff === 0 ? "hoje" : diff <= 3 ? "proximo" : "futuro"
      };
    });
    const ordem = { atrasado: 0, hoje: 1, proximo: 2, futuro: 3, sem_data: 4 };
    itens.sort(function(a, b) {
      const oa = ordem[a.urgencia], ob = ordem[b.urgencia];
      if (oa !== ob) return oa - ob;
      if (a.urgencia === "atrasado") return b.diasAtraso - a.diasAtraso;
      return (a.diasRestantes || 0) - (b.diasRestantes || 0);
    });
    return { ok: true, cobrancas: itens };
  } catch (e) { return { ok: false, error: e.message }; }
}

function excluirPedidoHard(p) {
  if (!_checkAdmin(p)) return { ok: false, erro: "Não autorizado — senha admin incorreta" };
  const id = String(p.id || "");
  const found = findRow("Pedidos", 0, id);
  if (!found) return { ok: false, erro: "Pedido não encontrado" };

  const headers = getHeaders("Pedidos");
  let lix = SS.getSheetByName("_Lixeira_Pedidos");
  if (!lix) {
    lix = SS.insertSheet("_Lixeira_Pedidos");
    lix.getRange(1, 1, 1, headers.length + 1).setValues([["Excluido_Em"].concat(headers)]);
    lix.setFrozenRows(1);
  }
  const rowVals = found.sh.getRange(found.rowNum, 1, 1, headers.length).getValues()[0];
  const lixObj = { "Excluido_Em": nowBR() };
  headers.forEach(function(h, i) { lixObj[h] = rowVals[i]; });
  appendRowByHeaders("_Lixeira_Pedidos", lixObj);
  found.sh.deleteRow(found.rowNum);

  // E1.5: baixas do pedido → backup em _Lixeira_Financeiro + remoção (sem órfãs)
  let baixasRemovidas = 0;
  const fin = SS.getSheetByName("Financeiro_Fluxo");
  if (fin && fin.getLastRow() > 1) {
    const fh = fin.getRange(1, 1, 1, fin.getLastColumn()).getValues()[0].map(String);
    const colPed = fh.indexOf("ID_Pedido");
    if (colPed >= 0) {
      let lixF = SS.getSheetByName("_Lixeira_Financeiro");
      if (!lixF) {
        lixF = SS.insertSheet("_Lixeira_Financeiro");
        lixF.getRange(1, 1, 1, fh.length + 1).setValues([["Excluido_Em"].concat(fh)]);
        lixF.setFrozenRows(1);
      }
      const data = fin.getDataRange().getValues();
      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][colPed]) === id) {
          const lixFObj = { "Excluido_Em": nowBR() };
          fh.forEach(function(h, j) { lixFObj[h] = data[i][j]; });
          appendRowByHeaders("_Lixeira_Financeiro", lixFObj);
          fin.deleteRow(i + 1);
          baixasRemovidas++;
        }
      }
    }
  }
  registrarAcao(p.operador, "EXCLUIR_PEDIDO_HARD", "Pedido", id,
    "linha removida + " + baixasRemovidas + " baixa(s) → backup em _Lixeira_Pedidos/_Lixeira_Financeiro");
  return { ok: true, baixasRemovidas };
}

// ── E2.4: HEALTH-CHECK do analytics (diagnóstico em 1 chamada, sem caça-fantasma) ──
function analyticsHealth() {
  const req = {
    "Logs_Metricas": ["Timestamp", "Acao"],
    "Acessos_Log": ["Data_Hora", "Tipo_Acao"],
    "Pedidos": ["ID Pedido", "Data/Hora", "Total (R$)", "Status"],
    "Financeiro_Fluxo": ["ID_Pedido", "Status_Pagamento", "Valor_Final_Recebido"],
    "CARRINHOS_ABANDONADOS": []
  };
  const problemas = [];
  const linhas = {};
  Object.keys(req).forEach(function (aba) {
    const sh = SS.getSheetByName(aba);
    if (!sh) { problemas.push("Aba ausente: " + aba); return; }
    linhas[aba] = sh.getLastRow() - 1;
    if (sh.getLastRow() < 1) { problemas.push("Aba sem header: " + aba); return; }
    const hs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
    req[aba].forEach(function (col) {
      if (hs.indexOf(col) < 0) problemas.push(aba + ": coluna ausente '" + col + "'");
    });
  });
  return { ok: problemas.length === 0, problemas: problemas, linhas: linhas };
}

// \u2500\u2500 PEDIDOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// X4: idempotência — duplo toque/retry de rede não pode criar 2 pedidos iguais.
// Chave = telefone+total+itens (conteúdo do pedido, não o timestamp). Janela de 60s.
// O lock precisa segurar a criação INTEIRA (não só um check-and-mark curto): Calendar/email
// dentro da criação podem levar vários segundos, e uma 2ª requisição concorrente que só espera
// um pouco e desiste cria duplicata mesmo assim — só travar por um instante não resolve.
function _dedupPedidoKey(p) {
  const raw = String(p.telefone || "") + "|" + String(p.total || "") + "|" + String(p.itens || "");
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw);
  return "dedupPed_" + digest.map(b => (b + 256) % 256).join("");
}
function novoPedido(p) {
  const cache = CacheService.getScriptCache();
  let dedupKey = "";
  let gotLock = false;
  let lock = null;
  try {
    dedupKey = _dedupPedidoKey(p);
    lock = LockService.getScriptLock();
    gotLock = lock.tryLock(20000);
    const cached = cache.get(dedupKey);
    if (cached) return JSON.parse(cached);
  } catch (e) {
    // Falha no mecanismo de dedup nunca pode bloquear um pedido de verdade (fail-open)
    console.warn("dedup novoPedido: " + e.message);
  }
  try {
    return _criarPedido(p, dedupKey, cache);
  } finally {
    if (gotLock) { try { lock.releaseLock(); } catch (e) {} }
  }
}
function _criarPedido(p, dedupKey, cache) {
  const sh = getSheet("Pedidos");
  const id = newPedidoId(); // BUG-07: ID curto de 5 caracteres alfanuméricos
  const itens = p.itens || "[]";
  const dataVenc = p.dataVencimento || "";
  const nomeCliente = p.nomeCliente || "";
  const telefone = p.telefone || "";
  const total = Number(p.total || 0);
  const qtdParcelas = Number(p.qtdParcelas || 1);
  const intervaloDias = Number(p.intervaloDias || 0);
  const responsavel   = p.responsavel   || "";
  const endereco      = p.endereco      || "";
  const cep           = p.cep           || "";
  const obsCliente    = p.obsCliente    || p.obs || "";
  const dataAcordada  = p.dataAcordada  || "";
  const dataLembrete  = p.dataLembrete  || "";

  const statusInicial = p.statusInicial || "Pendente";
  const dataHora = p.dataHora ? String(p.dataHora) : nowBR();
  const row = appendRowByHeaders("Pedidos", {
    "ID Pedido": id,
    "Data/Hora": dataHora,
    "Nome Cliente": nomeCliente,
    "Telefone": telefone,
    "Itens (JSON)": itens,
    "Subtotal (R$)": Number(p.subtotal || 0),
    "Cupom": String(p.cupom || "").trim().toUpperCase(),
    "Desconto (R$)": Number(p.desconto || 0),
    "tipoFrete": p.tipoFrete || "",
    "valorFrete": Number(p.valorFrete || 0),
    "Total (R$)": total,
    "Forma Pagamento": p.formaPagamento || "",
    "Status": statusInicial,
    "Observações": obsCliente,
    "Data_Vencimento": dataVenc,
    "ID_Evento_Agenda_Cobranca": "",
    "Fornecedor_Selecionado": "",
    "Custo_Lote": "",
    "Data_Finalizacao": "",
    "ID_Evento_Agenda_Status": "",
    "Data_Criacao": nowBR(),
    "Data_Confirmacao": "",
    "Qtd_Parcelas": qtdParcelas,
    "Intervalo_Dias": intervaloDias,
    "Responsavel": responsavel,
    "Endereco": endereco,
    "CEP": cep,
    "Data_Acordada": dataAcordada,
    "Data_Lembrete": dataLembrete
  });
  if (p.cupom) incrementaCupom(p.cupom);

  // Auto-registrar cliente se for novo
  try { autoRegistrarCliente(nomeCliente, telefone, id); } catch(e) { console.error("autoRegistrarCliente: " + e); }

  // Envia email de notificação
  try { sendEmailNovoPedido(id, p); } catch (err) { console.warn("Email: " + err.message); }

  const headers = getHeaders("Pedidos");

  // Cria evento "Pendente" na agenda (apenas para pedidos não-PDV)
  let idEventoPendente = "";
  if (statusInicial === "Pendente") try {
    idEventoPendente = criarEventoPendente(id, nomeCliente, total, itens, p.formaPagamento || "", telefone);
    if (idEventoPendente) {
      const colEP = headers.indexOf("ID_Evento_Agenda_Status") + 1;
      if (colEP > 0) {
        const rowInfo = findRow("Pedidos", 0, id);
        if (rowInfo) sh.getRange(rowInfo.rowNum, colEP).setValue(idEventoPendente);
      }
    }
  } catch (err) {
    console.warn("Agenda pendente: " + err.message);
  }

  // Cria evento de cobrança se houver vencimento
  let idEventoCobranca = "";
  if (dataVenc) {
    try {
      idEventoCobranca = criarEventoCobranca(id, nomeCliente, telefone, total, dataVenc);
      if (idEventoCobranca) {
        const colEC = headers.indexOf("ID_Evento_Agenda_Cobranca") + 1;
        if (colEC > 0) {
          const rowInfo = findRow("Pedidos", 0, id);
          if (rowInfo) sh.getRange(rowInfo.rowNum, colEC).setValue(idEventoCobranca);
        }
      }
    } catch (err) {
      console.warn("Agenda cobrança: " + err.message);
    }
  }

  const result = { ok: true, idPedido: id, idEventoPendente, idEventoCobranca };
  if (dedupKey && cache) { try { cache.put(dedupKey, JSON.stringify(result), 60); } catch (e) {} }
  return result;
}

function getPedidos(p) {
  const rows = sheetToObjects("Pedidos");
  let list = [...rows].reverse();
  // BUG-01: normaliza datas seriais; BUG-04: status vazio \u2192 Pendente; BUG-02: estoque vazio \u2192 null
  list = list.map(function(r) {
    return Object.assign({}, r, {
      "Data/Hora": normalizarDataHora(r["Data/Hora"]),
      "Status": r["Status"] || "Pendente"
    });
  });
  list = list.filter(function(r) { return r["Status"] !== "Deletado"; });
  if (p.status) list = list.filter(function(r) { return r["Status"] === p.status; });
  return { pedidos: list, total: list.length };
}

// DEBUG — busca pedido por ID incluindo Deletado. Retorna raw + metadados
function getPedidoById(p) {
  const id = String((p && p.id) || "").trim();
  if (!id) return { error: "id obrigatório" };
  const rows = sheetToObjects("Pedidos") || [];
  const idNorm = id.toUpperCase();
  const ped = rows.find(function(r) { return String(r["ID Pedido"] || "").trim().toUpperCase() === idNorm; });
  if (!ped) {
    // Fuzzy: contém
    const fuzzy = rows.filter(function(r) { return String(r["ID Pedido"] || "").toUpperCase().includes(idNorm); });
    return { error: "não encontrado", fuzzyMatches: fuzzy.map(function(r) { return { id: r["ID Pedido"], nome: r["Nome Cliente"], status: r["Status"] }; }).slice(0, 10) };
  }
  // Normaliza Data/Hora
  ped["Data/Hora"] = normalizarDataHora(ped["Data/Hora"]);
  // Baixas do pedido
  const baixas = (sheetToObjects("Financeiro_Fluxo") || []).filter(function(b) { return String(b["ID_Pedido"] || "") === String(ped["ID Pedido"]); });
  // Parse itens
  let itensParsed = null, parseError = null;
  try {
    const raw = String((ped["Itens (JSON)"] || ped["Itens"]) || "").trim();
    if (raw && raw !== "[]") itensParsed = JSON.parse(raw);
  } catch(e) { parseError = e.message; }
  return {
    ok: true,
    pedido: ped,
    baixas: baixas,
    itensParsed: itensParsed,
    itensParseError: parseError,
    debug: {
      itensRawLength: String((ped["Itens (JSON)"] || ped["Itens"]) || "").length,
      itensRawSample: String((ped["Itens (JSON)"] || ped["Itens"]) || "").substring(0, 200),
      qtdBaixas: baixas.length,
      status: ped["Status"] || "(vazio)"
    }
  };
}

function atualizarStatus(id, status, p) {
  if (!id || !status) return { error: "Parâmetros inválidos" };
  const found = findRow("Pedidos", 0, id);
  if (!found) return { error: "Pedido não encontrado" };
  const headers = getHeaders("Pedidos");
  const colStatus = headers.indexOf("Status") + 1;
  found.sh.getRange(found.rowNum, colStatus).setValue(status);

  // Monta objeto nomeado com os dados do pedido (independe da ordem das colunas)
  const pedObj = {};
  headers.forEach(function(h, i) { if (h) pedObj[h] = found.row[i]; });

  // Envia e-mail de notificação para qualquer mudança de status
  try {
    sendEmailStatusUpdate(id, status, pedObj);
  } catch(err) {
    console.error("Email status ERRO: " + err.message);
  }

  if (status === "Em andamento" || status === "Entregue") {
    const colConf = headers.indexOf("Data_Confirmacao") + 1;
    if (colConf > 0) {
      const jaTemConf = String(found.row[colConf - 1] || "").trim();
      if (!jaTemConf) found.sh.getRange(found.rowNum, colConf).setValue(nowBR());
    }
    const colEP = headers.indexOf("ID_Evento_Agenda_Status") + 1;
    if (colEP > 0) {
      const idEvPend = String(found.row[colEP - 1] || "");
      if (idEvPend) {
        try {
          const cal = CalendarApp.getDefaultCalendar();
          const ev = cal.getEventById(idEvPend);
          const label = status === "Entregue" ? "\uD83D\uDCE6 [ENTREGUE]" : "\uD83D\uDD35 [EM ANDAMENTO]";
          if (ev) ev.setTitle(label + " Pedido #" + id + " - " + (found.row[2] || ""));
        } catch (err) { console.warn("Agenda update: " + err.message); }
      }
    }
  }

  if (status === "Finalizado") {
    const colFin = headers.indexOf("Data_Finalizacao") + 1;
    if (colFin > 0) found.sh.getRange(found.rowNum, colFin).setValue(nowBR());
    // Atualiza evento da agenda para Finalizado
    const colEP = headers.indexOf("ID_Evento_Agenda_Status") + 1;
    if (colEP > 0) {
      const idEvPend = String(found.row[colEP - 1] || "");
      if (idEvPend) {
        try {
          const cal = CalendarApp.getDefaultCalendar();
          const ev = cal.getEventById(idEvPend);
          if (ev) ev.setTitle("\u2705 [FINALIZADO] Pedido #" + id + " - " + (found.row[2] || ""));
        } catch (err) { console.warn("Agenda update finalizado: " + err.message); }
      }
    }
    // Pós-venda: evento de feedback 7 dias após finalização
    try {
      const cal = CalendarApp.getDefaultCalendar();
      const colNomePV = headers.indexOf("Nome Cliente") >= 0 ? headers.indexOf("Nome Cliente") : 2;
      const colTelPV  = headers.indexOf("Telefone") >= 0 ? headers.indexOf("Telefone") : 3;
      const nomePV = String(found.row[colNomePV] || "");
      const telPV  = String(found.row[colTelPV] || "").replace(/\D/g, "");
      const posVendaDate = new Date();
      posVendaDate.setDate(posVendaDate.getDate() + 7);
      posVendaDate.setHours(10, 0, 0, 0);
      const msgFeedback = encodeURIComponent("Olá " + nomePV + "! \uD83D\uDE0A Passaram 7 dias desde sua compra na GJ Store. Como está o produto? Gostaríamos muito de saber sua opinião! \u2B50");
      const wppPV = "https://wa.me/55" + telPV + "?text=" + msgFeedback;
      const evPV = cal.createAllDayEvent("[PÓS-VENDA] Feedback - " + nomePV, posVendaDate);
      evPV.setDescription("Ligar/enviar mensagem pedindo avaliação do produto.\n\nCliente: " + nomePV + "\nPedido: #" + id + "\n\nWhatsApp direto: " + wppPV);
      evPV.setLocation(wppPV);
      try { evPV.addPopupReminder(0); } catch(e) {}
      try { evPV.addPopupReminder(60); } catch(e) {}
    } catch(err) { console.warn("Pos-venda evento: " + err.message); }
  }

  // Salva Fornecedor e Custo do Lote se informados
  if (p && p.fornecedor !== undefined) {
    const colF = headers.indexOf("Fornecedor_Selecionado") + 1;
    if (colF > 0) found.sh.getRange(found.rowNum, colF).setValue(p.fornecedor || "");
  }
  if (p && p.custoLote !== undefined) {
    const colC = headers.indexOf("Custo_Lote") + 1;
    if (colC > 0) found.sh.getRange(found.rowNum, colC).setValue(Number(p.custoLote) || 0);
  }

  return { ok: true };
}

// \u2500\u2500 SALVAR DATAS DO PEDIDO (Acordada / Lembrete) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setPedDates(p) {
  if (!p.id) return { error: "ID obrigatório" };
  const found = findRow("Pedidos", 0, p.id);
  if (!found) return { error: "Pedido não encontrado" };
  const headers = getHeaders("Pedidos");
  if (p.dataAcordada !== undefined) {
    const col = headers.indexOf("Data_Acordada") + 1;
    if (col > 0) found.sh.getRange(found.rowNum, col).setValue(p.dataAcordada || "");
  }
  if (p.dataLembrete !== undefined) {
    const col = headers.indexOf("Data_Lembrete") + 1;
    if (col > 0) found.sh.getRange(found.rowNum, col).setValue(p.dataLembrete || "");
  }
  return { ok: true };
}

// \u2500\u2500 EDITAR CAMPOS DO PEDIDO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function editarPedido(p) {
  if (!p.id) return { error: "ID obrigatório" };
  const found = findRow("Pedidos", 0, p.id);
  if (!found) return { error: "Pedido não encontrado" };
  const headers = getHeaders("Pedidos");
  const campos = {
    "Nome Cliente":           p.nomeCliente,
    "Telefone":               p.telefone,
    "Forma Pagamento":        p.formaPagamento,
    "Observações":            p.obs,
    "Data_Vencimento":        p.dataVencimento,
    "Desconto (R$)":          p.desconto !== undefined ? Number(p.desconto) : undefined,
    "Fornecedor_Selecionado": p.fornecedor,
    "Custo_Lote":             p.custoLote !== undefined ? Number(p.custoLote) : undefined,
    "Endereco":               p.endereco,
    "CEP":                    p.cep,
    "Responsavel":            p.responsavel,
    "Qtd_Parcelas":           p.qtdParcelas !== undefined && p.qtdParcelas !== "" ? Number(p.qtdParcelas) : undefined,
    // G5: editor de itens — grava só quando o front manda (edição de item alterou o pedido)
    "Itens (JSON)":           p.itens !== undefined ? p.itens : undefined,
    "Subtotal (R$)":          p.subtotal !== undefined ? Number(p.subtotal) : undefined,
    "Total (R$)":             p.total !== undefined ? Number(p.total) : undefined
  };
  Object.entries(campos).forEach(function([campo, valor]) {
    if (valor === undefined) return;
    const col = headers.indexOf(campo) + 1;
    if (col > 0) found.sh.getRange(found.rowNum, col).setValue(valor === "" ? "" : valor);
  });
  return { ok: true };
}

// \u2500\u2500 BAIXA FINANCEIRA (suporta pagamento parcial) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function darBaixa(p) {
  if (!p.idPedido) return { error: "ID do pedido obrigatório" };
  const found = findRow("Pedidos", 0, p.idPedido);
  if (!found) return { error: "Pedido não encontrado" };
  // Data retroativa: se fornecida usa ela, senão nowBR()
  const dataBaixaEfetiva = p.dataBaixa ? String(p.dataBaixa) : nowBR();

  const headers = getHeaders("Pedidos");
  const pedRow = found.row;

  const colNome = headers.indexOf("Nome Cliente") >= 0 ? headers.indexOf("Nome Cliente") : 2;
  const colTotal = headers.indexOf("Total (R$)") >= 0 ? headers.indexOf("Total (R$)") : 10;
  const colDataVenc = headers.indexOf("Data_Vencimento") >= 0 ? headers.indexOf("Data_Vencimento") : -1;
  const colTel = headers.indexOf("Telefone") >= 0 ? headers.indexOf("Telefone") : 3;

  const nomeCliente = String(pedRow[colNome] || "");
  const telefone = String(pedRow[colTel] || "");
  const valorOriginal = Number(pedRow[colTotal] || 0);
  const intervaloDias = Number(p.intervaloDias || 30);

  // Dias de atraso
  let diasAtraso = 0;
  if (p.statusPagamento === "Atrasado COM Taxa" || p.statusPagamento === "Atrasado SEM Taxa") {
    if (p.diasAtraso && Number(p.diasAtraso) > 0) {
      diasAtraso = Number(p.diasAtraso);
    } else if (colDataVenc >= 0) {
      const dtVencStr = String(pedRow[colDataVenc] || "");
      const dtVenc = parseDateBR(dtVencStr);
      if (dtVenc) {
        const hoje = new Date();
        diasAtraso = Math.max(0, Math.floor((hoje - dtVenc) / (1000 * 60 * 60 * 24)));
      }
    }
  }

  // Juros
  let taxaRS = 0;
  if (p.statusPagamento === "Atrasado COM Taxa" && diasAtraso > 0) {
    const taxaDiaria = Number(getConfigValue("TAXA_ATRASO_PADRAO_DIARIA_PERCENTUAL") || "0.33");
    taxaRS = valorOriginal * (taxaDiaria / 100) * diasAtraso;
  }
  const valorFinal = valorOriginal + taxaRS;

  // Valor efetivamente pago (pode ser parcial)
  // Verifica se há saldo pendente de pagamentos anteriores para usar como base
  const shFinCheck = getSheet("Financeiro_Fluxo");
  let baseValor = valorFinal;
  if (shFinCheck) {
    const baixasAnteriores = sheetToObjects("Financeiro_Fluxo")
      .filter(function(b) { return String(b["ID_Pedido"] || "") === String(p.idPedido) && String(b["Status_Pagamento"] || "") === "Pendente"; })
      .sort(function(a, b) { return String(b["ID_Baixa"] || "").localeCompare(String(a["ID_Baixa"] || "")); });
    if (baixasAnteriores.length > 0) {
      const saldoPendente = Number(baixasAnteriores[0]["Saldo_Restante"] || baixasAnteriores[0]["Valor_Original"] || valorFinal);
      if (saldoPendente > 0 && saldoPendente <= valorFinal) {
        baseValor = saldoPendente;
      }
      // Marca TODAS as linhas Pendente deste pedido como Liquidado
      const hFin = getHeaders("Financeiro_Fluxo");
      const colStat = hFin.indexOf("Status_Pagamento") + 1;
      if (colStat > 0) {
        baixasAnteriores.forEach(function(b) {
          const linhaB = findRow("Financeiro_Fluxo", 0, b["ID_Baixa"]);
          if (linhaB) linhaB.sh.getRange(linhaB.rowNum, colStat).setValue("Liquidado");
        });
      }
    }
  }
  const valorPago = p.valorPago !== undefined && p.valorPago !== "" ? Number(p.valorPago) : baseValor;
  const isParcial = valorPago < baseValor - 0.01;

  const shFin = getSheet("Financeiro_Fluxo");
  if (!shFin) return { error: "Aba Financeiro_Fluxo não existe. Execute setupSheets primeiro." };

  const statusFin = isParcial ? "Pago Parcial" : p.statusPagamento;
  const saldoRestante = isParcial ? (valorFinal - valorPago) : 0;

  // Registra pagamento (parcial ou total)
  appendRowByHeaders("Financeiro_Fluxo", {
    ID_Baixa: newId("BX"), ID_Pedido: p.idPedido, Nome_Cliente: nomeCliente,
    Valor_Original: valorOriginal, Status_Pagamento: statusFin, Dias_Atraso: diasAtraso,
    Taxa_Aplicada_RS: taxaRS.toFixed(2), Valor_Final_Recebido: valorPago.toFixed(2),
    Data_Baixa_Efetiva: dataBaixaEfetiva, Saldo_Restante: saldoRestante.toFixed(2),
    Proxima_Vencimento: "", Telefone: telefone, Forma_Pagamento: p.formaPagamento || ""
  });

  if (isParcial) {
    // Calcula próxima data de vencimento
    const proxima = new Date();
    proxima.setDate(proxima.getDate() + intervaloDias);
    const proximaFmt = Utilities.formatDate(proxima, "America/Sao_Paulo", "dd/MM/yyyy");

    // Cria linha pendente com o saldo restante
    appendRowByHeaders("Financeiro_Fluxo", {
      ID_Baixa: newId("BX"), ID_Pedido: p.idPedido, Nome_Cliente: nomeCliente,
      Valor_Original: saldoRestante, Status_Pagamento: "Pendente", Dias_Atraso: 0,
      Taxa_Aplicada_RS: "0.00", Valor_Final_Recebido: "0.00",
      Data_Baixa_Efetiva: "", Saldo_Restante: saldoRestante.toFixed(2),
      Proxima_Vencimento: proximaFmt, Telefone: telefone,
      Forma_Pagamento: p.formaPagamento || ""
    });

    // Cria evento de cobrança para o saldo restante
    try {
      const saldoFmt = "R$ " + saldoRestante.toFixed(2).replace(".", ",");
      const novoIdEvento = criarEventoCobranca(p.idPedido, nomeCliente, telefone, saldoRestante, proximaFmt);
      // Salva ID do novo evento na planilha para poder cancelar no futuro
      if (novoIdEvento) {
        const colEvCobranca = headers.indexOf("ID_Evento_Agenda_Cobranca") + 1;
        if (colEvCobranca > 0) found.sh.getRange(found.rowNum, colEvCobranca).setValue(novoIdEvento);
      }
    } catch(err) { console.warn("Agenda parcial: " + err.message); }

    // Status do pedido: mantém status atual se já for Entregue, senão Em andamento
    const colStatus = headers.indexOf("Status") + 1;
    const statusAtual = String(pedRow[headers.indexOf("Status")] || "");
    const statusManter = statusAtual === "Entregue" ? "Entregue" : "Em andamento";
    found.sh.getRange(found.rowNum, colStatus).setValue(statusManter);

    try { atualizarScore(nomeCliente, telefone, "No Prazo", 0); } catch(err) { console.error("atualizarScore darBaixa: " + err.message); }

    return {
      ok: true,
      parcial: true,
      valorPago: valorPago.toFixed(2),
      saldoRestante: saldoRestante.toFixed(2),
      proximaVencimento: proximaFmt,
      diasAtraso,
      telefone,
      nomeCliente
    };
  }

  // Pagamento total: finaliza o pedido
  const colStatus = headers.indexOf("Status") + 1;
  found.sh.getRange(found.rowNum, colStatus).setValue("Finalizado");
  const colFin = headers.indexOf("Data_Finalizacao") + 1;
  if (colFin > 0) found.sh.getRange(found.rowNum, colFin).setValue(nowBR());

  // Remove evento de cobrança
  const colEvento = headers.indexOf("ID_Evento_Agenda_Cobranca") + 1;
  if (colEvento > 0) {
    const idEvento = String(pedRow[colEvento - 1] || "");
    if (idEvento) {
      try {
        const cal = CalendarApp.getDefaultCalendar();
        const evento = cal.getEventById(idEvento);
        if (evento) evento.deleteEvent();
      } catch (err) { console.warn("Remoção agenda: " + err.message); }
    }
  }

  try { atualizarScore(nomeCliente, telefone, p.statusPagamento, diasAtraso); } catch(err) { console.error("atualizarScore status: " + err.message); }

  return {
    ok: true,
    parcial: false,
    valorOriginal,
    taxaRS: taxaRS.toFixed(2),
    valorFinal: valorFinal.toFixed(2),
    diasAtraso,
    telefone,
    nomeCliente
  };
}

// \u2500\u2500 FINANCEIRO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getFinanceiro(p) {
  const rows = sheetToObjects("Financeiro_Fluxo");
  if (!rows.length) return { baixas: [], total: 0 };
  const list = [...rows].reverse();
  return { baixas: list, total: list.length };
}

function getFinanceiroPendente() {
  const rows = sheetToObjects("Financeiro_Fluxo");
  const pendentes = rows.filter(r => String(r["Status_Pagamento"] || "") === "Pendente");
  return { pendentes, total: pendentes.length };
}

// \u2500\u2500 PREVISÃO DE CAIXA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getPrevisaoCaixa() {
  const rows = sheetToObjects("Pedidos");
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const em7  = new Date(hoje); em7.setDate(hoje.getDate() + 7);
  const em30 = new Date(hoje); em30.setDate(hoje.getDate() + 30);

  const statusExcluir = ["Finalizado", "Cancelado"];

  let prev7Count = 0, prev7Total = 0;
  let prev30Count = 0, prev30Total = 0;

  rows.forEach(r => {
    if (statusExcluir.includes(r["Status"])) return;
    const dvNorm = normalizarDataHora(r["Data_Vencimento"]);
    if (!dvNorm) return;
    const dv = parseDateBR(dvNorm.split(" ")[0]);
    if (!dv) return;
    dv.setHours(0, 0, 0, 0);
    const val = Number(r["Total (R$)"] || 0);
    if (dv >= hoje && dv <= em7) { prev7Count++; prev7Total += val; }
    else if (dv > em7 && dv <= em30) { prev30Count++; prev30Total += val; }
  });

  return {
    previsao7:  { total: prev7Total,  count: prev7Count },
    previsao30: { total: prev30Total, count: prev30Count }
  };
}

// \u2500\u2500 GERAR COMPROVANTE NO DRIVE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function gerarComprovanteDrive(p) {
  if (!p.idPedido) return { error: "ID do pedido obrigatório" };
  const found = findRow("Pedidos", 0, p.idPedido);
  if (!found) return { error: "Pedido não encontrado" };

  const headers = getHeaders("Pedidos");
  const pedRow = found.row;
  const obj = {};
  headers.forEach((h, i) => { obj[h] = pedRow[i]; });

  const termoGarantia = p.termoGarantia || getConfigValue("TERMO_GARANTIA_GLOBAL") || "90 dias contra defeitos de fabricação";
  const obs = p.obs || obj["Observações"] || "";
  const nomeCliente = obj["Nome Cliente"] || "";
  const telefone = obj["Telefone"] || "";
  const itens = (obj["Itens (JSON)"] || obj["Itens"]) || "";
  const total = Number(obj["Total (R$)"] || 0);
  const subtotal = Number(obj["Subtotal (R$)"] || obj["Subtotal"] || 0);
  const desconto = Number(obj["Desconto (R$)"] || obj["Desconto"] || 0);
  const frete = Number(obj["Valor Frete (R$)"] || obj["Frete"] || 0);
  const pagamento = obj["Forma Pagamento"] || "";
  const status = obj["Status"] || "";
  const dataHora = obj["Data/Hora"] || nowBR();

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8">
<style>
body{font-family:Arial,sans-serif;color:#000;margin:0;padding:24px;max-width:680px}
.header{background:#000;color:#fff;padding:18px 24px;border-radius:8px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}
.header h1{margin:0;font-size:26px;letter-spacing:2px}
.header .sub{font-size:12px;opacity:.7;margin-top:4px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.info-box{border:1px solid #ddd;border-radius:6px;padding:12px}
.info-box label{font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:4px}
.info-box span{font-size:14px;font-weight:600;color:#000}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{background:#f5f5f5;padding:10px 12px;text-align:left;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;border-bottom:2px solid #ddd}
td{padding:10px 12px;border-bottom:1px solid #eee;font-size:13px}
.total-row{background:#f9f9f9;font-weight:700}
.total-final{background:#000;color:#fff;font-size:16px}
.total-final td{padding:14px 12px}
.garantia{background:#f0fff0;border:1px solid #00e676;border-radius:6px;padding:14px;margin-bottom:20px;font-size:12px;color:#333}
.garantia strong{color:#000}
.obs-box{border:1px solid #ddd;border-radius:6px;padding:12px;margin-bottom:20px;font-size:12px;color:#555}
.footer{text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:14px;margin-top:20px}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;background:#000;color:#fff}
</style>
</head>
<body>
<div class="header">
  <div>
    <h1>GJ STORE</h1>
    <div class="sub">Comprovante de Pedido</div>
  </div>
  <div style="text-align:right">
    <div style="font-size:11px;opacity:.7">Pedido</div>
    <div style="font-size:18px;font-weight:700">#${escapeHTML(p.idPedido)}</div>
    <div class="badge">${escapeHTML(status)}</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-box"><label>Cliente</label><span>${escapeHTML(nomeCliente)}</span></div>
  <div class="info-box"><label>Telefone</label><span>${escapeHTML(telefone)}</span></div>
  <div class="info-box"><label>Data</label><span>${escapeHTML(dataHora)}</span></div>
  <div class="info-box"><label>Pagamento</label><span>${escapeHTML(pagamento)}</span></div>
</div>

<table>
  <thead><tr><th>Descrição</th><th>Qtd</th></tr></thead>
  <tbody>
    ${itens.split("|").map(item => item.trim()).filter(Boolean).map(item => {
      const match = item.match(/^(.+?)\s+x(\d+)$/);
      const desc = match ? match[1] : item;
      const qty  = match ? match[2] : "1";
      return `<tr><td>${escapeHTML(desc)}</td><td>${qty}</td></tr>`;
    }).join("")}
  </tbody>
</table>

<table>
  <tbody>
    ${subtotal > 0 ? `<tr><td>Subtotal</td><td style="text-align:right">R$ ${subtotal.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>` : ""}
    ${desconto > 0 ? `<tr><td>Desconto</td><td style="text-align:right">\u2212 R$ ${desconto.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>` : ""}
    ${frete > 0 ? `<tr><td>Frete</td><td style="text-align:right">R$ ${frete.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>` : `<tr><td>Frete</td><td style="text-align:right">Grátis</td></tr>`}
    <tr class="total-final"><td>TOTAL</td><td style="text-align:right;font-size:18px">R$ ${total.toLocaleString("pt-BR",{minimumFractionDigits:2})}</td></tr>
  </tbody>
</table>

${termoGarantia ? `<div class="garantia"><strong>\u26A1 Garantia:</strong> ${escapeHTML(termoGarantia)}</div>` : ""}
${obs ? `<div class="obs-box"><strong>Observações:</strong> ${escapeHTML(obs)}</div>` : ""}

<div class="footer">
  GJ Store · WhatsApp: 55 21 97036-3062<br>
  Documento gerado em ${nowBR()} · GJ Store © ${new Date().getFullYear()}
</div>
</body>
</html>`;

  // Cria ou encontra pasta "GJ Store Comprovantes" no Drive
  let folder;
  const folders = DriveApp.getFoldersByName("GJ Store Comprovantes");
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder("GJ Store Comprovantes");
  }

  const filename = "Comprovante_" + p.idPedido + "_" + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyyMMdd_HHmm") + ".html";
  const file = folder.createFile(filename, html, MimeType.HTML);
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

  return { ok: true, url: file.getUrl(), fileId: file.getId() };
}

// \u2500\u2500 EMAIL: NOVO PEDIDO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function sendEmailNovoPedido(id, p) {
  const emailDest = getConfigValue("EMAIL_NOTIFICACAO");
  if (!emailDest) return;
  const nomeLoja = getConfigValue("NOME_LOJA") || "GJ Store";

  const nomeCliente = p.nomeCliente || "";
  const telefone    = p.telefone || "";
  const itens       = p.itens || "";
  const total       = parseFloat(String(p.total || "0").replace(",", ".")) || 0;
  const pagamento   = p.formaPagamento || "";
  const tipoFrete   = p.tipoFrete || "";
  const dataVenc    = p.dataVencimento || "";
  const totalFmt    = "R$ " + total.toFixed(2).replace(".", ",");

  const itensList = itens.split("|").map(function(i){ return i.trim(); }).filter(Boolean)
    .map(function(i){ return "<tr><td style='padding:9px 12px;border-bottom:1px solid #1e2e45;font-size:13px;color:#e2f4ff'>" + i + "</td></tr>"; })
    .join("");

  const htmlBody = "<!DOCTYPE html><html lang='pt-BR'><head><meta charset='UTF-8'></head>"
  + "<body style='margin:0;padding:0;background:#04090f;font-family:Arial,sans-serif'>"
  + "<table width='100%' cellpadding='0' cellspacing='0' bgcolor='#04090f'><tr><td align='center' style='padding:24px 16px'>"
  + "<table width='580' cellpadding='0' cellspacing='0' style='max-width:580px'>"

  // Header
  + "<tr><td align='center' style='background:#00e676;border-radius:14px 14px 0 0;padding:24px'>"
  + "<div style='font-size:32px;font-weight:900;color:#04090f;letter-spacing:-1px;font-family:Arial Black,Arial,sans-serif'>" + nomeLoja.toUpperCase() + "</div>"
  + "<div style='font-size:14px;color:#04090f;font-weight:700;margin-top:6px'>[ NOVO PEDIDO RECEBIDO ]</div>"
  + "</td></tr>"

  // ID
  + "<tr><td style='background:#08111f;padding:16px;text-align:center;border-left:1px solid #1a2840;border-right:1px solid #1a2840'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>ID DO PEDIDO</div>"
  + "<div style='font-size:20px;font-weight:700;color:#00e676;letter-spacing:1px'>#" + id + "</div>"
  + "<div style='font-size:11px;color:#556;margin-top:4px'>" + nowBR() + "</div>"
  + "</td></tr>"

  // Cliente
  + "<tr><td style='background:#060c18;padding:16px;border-left:1px solid #1a2840;border-right:1px solid #1a2840;border-top:1px solid #1a2840'>"
  + "<table width='100%' cellpadding='0' cellspacing='0'>"
  + "<tr><td style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;padding-bottom:8px'>CLIENTE</td></tr>"
  + "<tr><td style='font-size:16px;font-weight:700;color:#e2f4ff;padding-bottom:4px'>" + nomeCliente + "</td></tr>"
  + "<tr><td style='font-size:13px;color:#8899aa'>Telefone: " + telefone + "</td></tr>"
  + (dataVenc ? "<tr><td style='font-size:13px;color:#ff6d00;padding-top:4px'>Vencimento: " + dataVenc + "</td></tr>" : "")
  + "</table></td></tr>"

  // Itens
  + "<tr><td style='background:#060c18;padding:16px;border-left:1px solid #1a2840;border-right:1px solid #1a2840;border-top:1px solid #1a2840'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px'>ITENS DO PEDIDO</div>"
  + "<table width='100%' cellpadding='0' cellspacing='0'>" + itensList + "</table>"
  + "</td></tr>"

  // Pagamento + Frete
  + "<tr><td style='background:#060c18;padding:12px 16px;border-left:1px solid #1a2840;border-right:1px solid #1a2840;border-top:1px solid #1a2840'>"
  + "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
  + "<td style='font-size:12px;color:#8899aa'>Pagamento: <strong style='color:#e2f4ff'>" + pagamento + "</strong></td>"
  + "<td style='font-size:12px;color:#8899aa;text-align:right'>Frete: <strong style='color:#e2f4ff'>" + tipoFrete + "</strong></td>"
  + "</tr></table></td></tr>"

  // Total
  + "<tr><td style='background:#00e676;padding:16px;text-align:center;border-radius:0 0 14px 14px'>"
  + "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
  + "<td style='font-size:16px;font-weight:700;color:#04090f'>TOTAL DO PEDIDO</td>"
  + "<td style='font-size:26px;font-weight:900;color:#04090f;text-align:right'>" + totalFmt + "</td>"
  + "</tr></table></td></tr>"

  // Rodapé
  + "<tr><td style='padding:16px;text-align:center'>"
  + "<a href='https://wa.me/55" + String(telefone).replace(/\D/g,"") + "?text=Ol%C3%A1+" + encodeURIComponent(nomeCliente) + "!+Pedido+recebido!'"
  + " style='display:inline-block;background:#25d366;color:#fff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px'>Responder pelo WhatsApp</a>"
  + "<div style='font-size:10px;color:#445;margin-top:14px'>" + nomeLoja + " Admin - Notificacao automatica</div>"
  + "</td></tr>"

  + "</table></td></tr></table></body></html>";

  GmailApp.sendEmail(emailDest, "[NOVO PEDIDO] #" + id + " - " + nomeCliente + " - " + totalFmt, "", {
    htmlBody: htmlBody,
    name: nomeLoja
  });
}

// \u2500\u2500 EMAIL: ATUALIZAÇÃO DE STATUS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function sendEmailStatusUpdate(idPedido, status, pedObj) {
  const adminEmail = getConfigValue("EMAIL_NOTIFICACAO");
  if (!adminEmail) { console.warn("EMAIL_NOTIFICACAO nao configurado"); return; }
  const nomeLoja2 = getConfigValue("NOME_LOJA") || "GJ Store";
  // pedObj é um objeto nomeado {coluna: valor} \u2014 independe da ordem das colunas
  const nomeCliente = String(pedObj["Nome Cliente"] || pedObj["Nome_Cliente"] || "");
  const telefone    = String(pedObj["Telefone"] || "");
  const itens       = String((pedObj["Itens (JSON)"] || pedObj["Itens"]) || "");
  const total       = parseFloat(String(pedObj["Total (R$)"] || pedObj["Total"] || "0").replace(",", ".")) || 0;
  const pagamento   = String(pedObj["Forma Pagamento"] || pedObj["Forma_Pagamento"] || "");
  const totalFmt    = "R$ " + total.toFixed(2).replace(".", ",");
  const corBg       = { "Em andamento": "#00bcd4", "Finalizado": "#00e676", "Cancelado": "#f44336" }[status] || "#ff6d00";
  const labelStatus = { "Em andamento": "EM ANDAMENTO", "Finalizado": "FINALIZADO", "Cancelado": "CANCELADO" }[status] || status.toUpperCase();
  const subject     = "[" + labelStatus + "] Pedido #" + idPedido + " - " + nomeCliente;

  const itensList = itens.split("|").map(function(i){ return i.trim(); }).filter(Boolean)
    .map(function(i){ return "<tr><td style='padding:7px 10px;border-bottom:1px solid #1e2e45;font-size:13px;color:#e2f4ff'>" + i + "</td></tr>"; })
    .join("");

  var htmlBody = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
  + "<body style='margin:0;padding:0;background:#04090f;font-family:Arial,sans-serif'>"
  + "<table width='100%' cellpadding='0' cellspacing='0' bgcolor='#04090f'><tr><td align='center' style='padding:24px 16px'>"
  + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px'>"
  + "<tr><td align='center' style='background:" + corBg + ";border-radius:14px 14px 0 0;padding:22px'>"
  + "<div style='font-size:28px;font-weight:900;color:#04090f;font-family:Arial Black,Arial,sans-serif'>" + nomeLoja2.toUpperCase() + "</div>"
  + "<div style='font-size:15px;font-weight:700;color:#04090f;margin-top:6px'>[ PEDIDO " + labelStatus + " ]</div>"
  + "</td></tr>"
  + "<tr><td style='background:#060c18;padding:20px;border-left:1px solid #1a2840;border-right:1px solid #1a2840'>"
  + "<table width='100%' cellpadding='8' cellspacing='0' style='background:#08111f;border-radius:10px'>"
  + "<tr><td style='font-size:11px;color:#556;width:110px'>ID Pedido</td><td style='font-size:13px;font-weight:700;color:#00e676'>#" + idPedido + "</td></tr>"
  + "<tr style='border-top:1px solid #1a2840'><td style='font-size:11px;color:#556'>Cliente</td><td style='font-size:14px;font-weight:700;color:#e2f4ff'>" + nomeCliente + "</td></tr>"
  + "<tr style='border-top:1px solid #1a2840'><td style='font-size:11px;color:#556'>Telefone</td><td style='font-size:13px;color:#e2f4ff'>" + telefone + "</td></tr>"
  + "<tr style='border-top:1px solid #1a2840'><td style='font-size:11px;color:#556'>Pagamento</td><td style='font-size:13px;color:#e2f4ff'>" + pagamento + "</td></tr>"
  + "<tr style='border-top:1px solid #1a2840'><td style='font-size:11px;color:#556'>Status</td><td style='font-size:14px;font-weight:800;color:" + corBg + "'>" + labelStatus + "</td></tr>"
  + "</table></td></tr>"
  + (itensList ? "<tr><td style='background:#060c18;padding:0 20px 4px;border-left:1px solid #1a2840;border-right:1px solid #1a2840'>"
    + "<div style='font-size:10px;color:#556;text-transform:uppercase;letter-spacing:1px;padding:12px 0 6px'>Itens</div>"
    + "<table width='100%' cellpadding='0' cellspacing='0'>" + itensList + "</table></td></tr>" : "")
  + "<tr><td style='background:" + corBg + ";padding:14px 20px;text-align:center;border-radius:0 0 14px 14px'>"
  + "<table width='100%' cellpadding='0' cellspacing='0'><tr>"
  + "<td style='font-size:15px;font-weight:700;color:#04090f'>TOTAL</td>"
  + "<td style='font-size:24px;font-weight:900;color:#04090f;text-align:right'>" + totalFmt + "</td>"
  + "</tr></table></td></tr>"
  + "<tr><td style='padding:14px;text-align:center'>"
  + "<a href='https://wa.me/55" + telefone.replace(/\D/g,"") + "' style='display:inline-block;background:#25d366;color:#fff;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:13px'>Falar com o Cliente</a>"
  + "<div style='font-size:10px;color:#445;margin-top:12px'>" + nomeLoja2 + " Admin - Notificacao automatica</div>"
  + "</td></tr>"
  + "</table></td></tr></table></body></html>";

  GmailApp.sendEmail(adminEmail, subject, "", { htmlBody: htmlBody, name: nomeLoja2 });
}

// \u2500\u2500 AGENDA: EVENTO PENDENTE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _proximoHorarioComercial() {
  var d = new Date();
  d.setSeconds(0, 0);
  var h = d.getHours();
  var min = d.getMinutes();
  // Se passou das 17h, pula pro próximo dia útil 10h
  if (h >= 17) {
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
  } else if (h < 10) {
    d.setHours(10, 0, 0, 0);
  } else {
    // Próximo horário cheio (agora + 1h, arredondado)
    d.setHours(h + 1, 0, 0, 0);
  }
  return d;
}

function criarEventoPendente(idPedido, nomeCliente, valor, itens, pagamento, telefone) {
  try {
    const cal = CalendarApp.getDefaultCalendar();
    var inicio = _proximoHorarioComercial();
    var fim = new Date(inicio.getTime() + 60 * 60 * 1000);
    const titulo = "\uD83D\uDFE1 [PENDENTE] #" + idPedido + " \u2014 " + nomeCliente;
    const totalFmt = "R$ " + Number(valor).toFixed(2).replace(".", ",");
    const wppLink = "https://wa.me/55" + String(telefone || "").replace(/\D/g, "");
    const itensFmt = String(itens || "").split("|").map(function(i){ return "  \u2022 " + i.trim(); }).filter(Boolean).join("\n");
    const slaHoras = Number(getConfigValue("SLA_PENDENTE_HORAS") || "24");
    const desc = [
      "\u2501\u2501\u2501 NOVO PEDIDO \u2501\u2501\u2501",
      "",
      "\uD83D\uDC64 Cliente  : " + nomeCliente,
      "\uD83D\uDCDE Telefone : " + (telefone || ""),
      "\uD83D\uDCCD WhatsApp : " + wppLink,
      "\uD83D\uDCC6 Data     : " + nowBR(),
      "",
      "\uD83D\uDCE6 Itens:",
      itensFmt || "  (nenhum)",
      "",
      "\uD83D\uDCB3 Pagamento: " + (pagamento || "N/I"),
      "\uD83D\uDCB0 Total    : " + totalFmt,
      "",
      "\u23F3 Responder em at\u00E9 " + slaHoras + " horas",
      "    " + wppLink
    ].join("\n");
    const evento = cal.createEvent(titulo, inicio, fim);
    evento.setDescription(desc);
    try { evento.addPopupReminder(0); } catch(e) {}
    try { evento.addPopupReminder(15); } catch(e) {}
    try { evento.addEmailReminder(60); } catch(e) {}
    return evento.getId();
  } catch (err) {
    console.warn("criarEventoPendente: " + err.message);
    return "";
  }
}

// \u2500\u2500 AGENDA: EVENTO DE COBRANÇA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function criarEventoCobranca(idPedido, nomeCliente, telefone, valor, dataVencStr) {
  const dv = parseDateBR(String(dataVencStr));
  if (!dv) return "";
  dv.setHours(9, 0, 0, 0);

  const cal = CalendarApp.getDefaultCalendar();
  const titulo = "\uD83D\uDCB0 [COBRAN\u00C7A] Receber de " + nomeCliente + " \u2014 #" + idPedido;
  const wppLink = "https://wa.me/55" + String(telefone).replace(/\D/g, "");
  const totalFmt2 = "R$ " + Number(valor).toFixed(2).replace(".", ",");
  const desc = [
    "\u2501\u2501\u2501 COBRAN\u00C7A AGENDADA \u2501\u2501\u2501",
    "",
    "\uD83D\uDC64 Cliente  : " + nomeCliente,
    "\uD83D\uDCDE Telefone : " + telefone,
    "\uD83D\uDCCD Pedido   : #" + idPedido,
    "\uD83D\uDCB0 Valor    : " + totalFmt2,
    "\uD83D\uDCC5 Vencimento: " + dataVencStr,
    "",
    "\u2501\u2501\u2501 A\u00E7\u00E3o \u2501\u2501\u2501",
    "Clique no local do evento para cobrar via WhatsApp",
    wppLink
  ].join("\n");

  const msgCobranca = encodeURIComponent("Ol\u00E1 " + nomeCliente + "! \uD83D\uDC4B Passando para lembrar do vencimento hoje de *" + totalFmt2 + "* referente ao pedido #" + idPedido + ". Podemos confirmar o pagamento? \uD83D\uDE4F");
  const wppClickLink = wppLink + "?text=" + msgCobranca;

  const fim = new Date(dv.getTime() + 60 * 60 * 1000); // 1h depois (9h→10h)
  const evento = cal.createEvent(titulo, dv, fim);
  evento.setDescription(desc);
  evento.setLocation(wppClickLink);
  try { evento.addPopupReminder(0); } catch (e) {}   // popup ao iniciar (9h)
  try { evento.addEmailReminder(1440); } catch (e) {} // email D-1

  return evento.getId();
}

// \u2500\u2500 CRM: CLIENTES SUMIDOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getCRM() {
  const rows = sheetToObjects("Pedidos");
  const diasLimite = Number(getConfigValue("RECORRENCIA_ALERTA_DIAS") || "45");
  const agora = new Date();

  const mapa = {};
  rows.forEach(r => {
    const tel = String(r["Telefone"] || "").replace(/\D/g, "");
    if (!tel) return;
    const nome = r["Nome Cliente"] || "";
    const dtStr = String(r["Data/Hora"] || "");
    if (!dtStr) return;

    const [datePart] = dtStr.split(" ");
    const [d, m, y] = datePart.split("/");
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dt.getTime())) return;

    if (!mapa[tel] || dt > mapa[tel].ultima) {
      mapa[tel] = { tel, nome, ultima: dt, ultimaStr: datePart };
    }
  });

  const sumidos = Object.values(mapa)
    .map(c => {
      const dias = Math.floor((agora - c.ultima) / (1000 * 60 * 60 * 24));
      return { ...c, diasSemComprar: dias, ultima: c.ultimaStr };
    })
    .filter(c => c.diasSemComprar >= diasLimite)
    .sort((a, b) => b.diasSemComprar - a.diasSemComprar);

  return { clientes: sumidos, total: sumidos.length };
}

// \u2500\u2500 LOG DE ACESSOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function logAcesso(p) {
  const sh = getSheet("Acessos_Log");
  if (!sh) return { ok: false, error: "Aba Acessos_Log não existe" };
  appendRowByHeaders("Acessos_Log", {
    Data_Hora: nowBR(), ID_Produto: p.idProduto || p.id || "",
    Tipo_Acao: p.tipoAcao || "Clique_Detalhes"
  });
  return { ok: true };
}

// \u2500\u2500 LOG DE CARRINHOS ABANDONADOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function logCarrinho(p) {
  const sh = getSheet("CARRINHOS_ABANDONADOS");
  if (!sh) return { error: "Aba CARRINHOS_ABANDONADOS não existe. Execute setupSheets." };
  appendRowByHeaders("CARRINHOS_ABANDONADOS", {
    Data_Hora: nowBR(), Nome: p.nome || "", Telefone: p.tel || "",
    Itens: p.itens || "", Total_RS: Number(p.total || 0)
  });
  return { ok: true };
}

// G6/filtro (2026-08-03): dias configurável pelo admin. 0/"todos" = sem cutoff.
function getCarrinhosAbandonados(p) {
  const sh = getSheet("CARRINHOS_ABANDONADOS");
  if (!sh) return { carrinhos: [] };
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { carrinhos: [] };
  // Expected columns: Data | Nome | Tel | Itens | Total
  // BUG-CARRINHO-DATA-DIASEMANA (2026-08-03): r[0] pode vir como Date object da planilha —
  // String(dateObj).split(" ")[0] pegava "Sat"/"Sun" (dia da semana em EN) em vez da data,
  // fazendo o filtro de cutoff nunca bater com nada (269 carrinhos reais, 0 exibidos sempre).
  const rows = data.slice(1).map(r => ({
    data:  r[0] ? normalizarDataHora(r[0]).split(" ")[0] : "",
    nome:  r[1] || "",
    tel:   String(r[2] || "").replace(/\D/g, ""),
    itens: r[3] || "",
    total: Number(r[4] || 0)
  }));
  const diasParam = p && p.dias !== undefined ? String(p.dias) : "30";
  const semCutoff = diasParam === "0" || diasParam === "todos";
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - (Number(diasParam) || 30));
  const recent = rows
    .filter(r => r.nome && r.tel)
    .filter(r => {
      if (semCutoff) return true;
      if (!r.data) return false;
      const parts = String(r.data).split("/");
      if (parts.length < 3) return false;
      const d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
      return !isNaN(d.getTime()) && d >= cutoff;
    })
    .reverse()
    .slice(0, 30);
  return { carrinhos: recent };
}

// \u2500\u2500 CUPONS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getCupom(codigo) {
  if (!codigo) return { error: "Código não informado" };
  const codigoNorm = String(codigo).trim().toUpperCase();
  const rows = sheetToObjects("Cupons");
  const c = rows.find(r =>
    String(r["Código"]).trim().toUpperCase() === codigoNorm &&
    String(r["Ativo?"]).toLowerCase() === "sim"
  );
  if (!c) return { error: "Cupom inválido ou inativo" };
  if (c["Validade"]) {
    const parts = String(c["Validade"]).split("/");
    if (parts.length === 3) {
      const exp = new Date(parts[2], parts[1] - 1, parts[0]);
      if (exp < new Date()) return { error: "Cupom expirado" };
    }
  }
  if (c["Usos Máx"] && Number(c["Usos Realizados"]) >= Number(c["Usos Máx"])) {
    return { error: "Cupom esgotado" };
  }
  return { cupom: c };
}

function incrementaCupom(codigo) {
  const sh = getSheet("Cupons");
  if (!sh) return;
  const data = sh.getDataRange().getValues();
  const headers = data[0];
  const usosCol = headers.indexOf("Usos Realizados") + 1;
  const codigoNorm = String(codigo).trim().toUpperCase();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === codigoNorm) {
      sh.getRange(i + 1, usosCol).setValue(Number(data[i][usosCol - 1] || 0) + 1);
      break;
    }
  }
}

function getCupons() {
  const rows = sheetToObjects("Cupons");
  return { cupons: rows };
}

function salvarCupom(p) {
  const sh = getSheet("Cupons");
  if (!sh) return { error: "Aba Cupons não encontrada" };
  const headers = getHeaders("Cupons");
  const row = headers.map(h => p[h] !== undefined ? p[h] : "");
  const found = findRow("Cupons", 0, p["Código"] || "");
  if (found) {
    sh.getRange(found.rowNum, 1, 1, row.length).setValues([row]);
    return { ok: true, action: "updated" };
  }
  sh.appendRow(row);
  return { ok: true, action: "created" };
}

// \u2500\u2500 LOG DE AÇÕES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function logAcao(p) {
  try {
    let sh = getSheet("Logs_Metricas");
    if (!sh) {
      sh = SS.insertSheet("Logs_Metricas");
      sh.getRange(1, 1, 1, 7).setValues([["Timestamp", "ID_Sessao", "Acao", "Detalhe", "Origem", "Dispositivo", "VID"]]);
      sh.setFrozenRows(1);
    } else {
      // Migração: adiciona coluna VID se não existe
      const hdrs = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
      if (!hdrs.includes("VID")) sh.getRange(1, hdrs.length + 1).setValue("VID");
    }
    appendRowByHeaders("Logs_Metricas", {
      Timestamp: nowBR(), ID_Sessao: p.sessao || "", Acao: p.acao || "",
      Detalhe: p.detalhe || "", Origem: p.origem || "",
      Dispositivo: p.dispositivo || "", VID: p.vid || ""
    });
    return { ok: true };
  } catch(err) {
    return { error: err.message };
  }
}

// \u2500\u2500 MÉTRICAS / ANALYTICS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// BUG-03: mapeia tipo da Acessos_Log para ação padrão
function mapTipoAcao(tipo) {
  var map = {
    "Clique_Detalhes": "VIEW_PRODUCT",
    "Adicionar_Carrinho": "ADD_TO_CART",
    "Pre_Cadastro": "PAGE_VIEW",
    "VIEW_PRODUCT": "VIEW_PRODUCT",
    "ADD_TO_CART": "ADD_TO_CART",
    "PAGE_VIEW": "PAGE_VIEW",
    "CHECKOUT_START": "CHECKOUT_START",
    "ORDER_CREATED": "ORDER_CREATED"
  };
  return map[tipo] || tipo || "PAGE_VIEW";
}

function getMetricas(p) {
  const dias = Number(p.dias || 30);
  let cutoff;
  let cutoffFim = null;
  if (p.dataInicio) {
    cutoff = parseDateBR(p.dataInicio);
    if (!cutoff) { cutoff = new Date(); cutoff.setDate(cutoff.getDate() - dias); }
    if (p.dataFim) { cutoffFim = parseDateBR(p.dataFim); if (cutoffFim) cutoffFim.setHours(23,59,59,0); }
  } else {
    cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dias);
  }

  // Fonte 1: Logs_Metricas (logAcao \u2014 ações estruturadas do site e admin)
  const rowsMetricas = sheetToObjects("Logs_Metricas") || [];

  // Fonte 2: Acessos_Log (formato legado) \u2014 exclui VIEW_PRODUCT e ADD_TO_CART
  // pois Logs_Metricas j\u00e1 captura ambos via logAcao() \u2014 evita contagem dupla
  const rowsAcessos = sheetToObjects("Acessos_Log") || [];
  const ACESSOS_EXCLUIR = ["Clique_Detalhes", "VIEW_PRODUCT", "Adicionar_Carrinho", "ADD_TO_CART"];
  const acessosNorm = rowsAcessos
    .filter(function(r) { return !ACESSOS_EXCLUIR.includes(r["Tipo_Acao"]); })
    .map(function(r) {
      return {
        "Timestamp": r["Data_Hora"] || "",
        "ID_Sessao": "",
        "Acao": mapTipoAcao(r["Tipo_Acao"]),
        "Detalhe": r["ID_Produto"] || "",
        "Origem": "index",
        "Dispositivo": "",
        "VID": ""
      };
    });

  // Combina e filtra pelo período
  const todas = rowsMetricas.concat(acessosNorm);
  const filtradas = todas.filter(function(r) {
    const ts = r["Timestamp"] ? parseDateBR(normalizarDataHora(r["Timestamp"]).split(" ")[0]) : null;
    if (!ts || ts < cutoff) return false;
    if (cutoffFim && ts > cutoffFim) return false;
    return true;
  });

  const totalAcessos       = filtradas.filter(function(r) { return r["Acao"] === "PAGE_VIEW"; }).length;
  const totalProdutosVistos = filtradas.filter(function(r) { return r["Acao"] === "VIEW_PRODUCT"; }).length;
  const totalCarrinhos     = filtradas.filter(function(r) { return r["Acao"] === "ADD_TO_CART"; }).length;
  const totalCheckouts     = filtradas.filter(function(r) { return r["Acao"] === "CHECKOUT_START"; }).length;
  const totalPedidos       = filtradas.filter(function(r) { return r["Acao"] === "ORDER_CREATED"; }).length;

  // Acessos por dia
  const diaMap = {};
  filtradas.filter(function(r) { return r["Acao"] === "PAGE_VIEW"; }).forEach(function(r) {
    const d = normalizarDataHora(r["Timestamp"]).split(" ")[0];
    if (d) diaMap[d] = (diaMap[d] || 0) + 1;
  });
  const acessosPorDia = Object.entries(diaMap)
    .sort(function(a, b) { return a[0].localeCompare(b[0]); })
    .map(function(e) { return { data: e[0], total: e[1] }; });

  // Top produtos (VIEW_PRODUCT de ambas as fontes)
  const prodMap = {};
  filtradas.filter(function(r) { return r["Acao"] === "VIEW_PRODUCT" && r["Detalhe"]; }).forEach(function(r) {
    const id = String(r["Detalhe"]);
    prodMap[id] = (prodMap[id] || 0) + 1;
  });
  const prods_ = sheetToObjects("Produtos");
  const topProdutos = Object.entries(prodMap)
    .sort(function(a, b) { return b[1] - a[1]; })
    .slice(0, 10)
    .map(function(e) {
      const prod = prods_.find(function(p) { return String(p["ID"]) === e[0]; });
      return { id: e[0], nome: prod ? (prod["Nome do Produto"] || prod["Nome"] || e[0]) : e[0], total: e[1] };
    });

  // Acessos por hora — apenas PAGE_VIEW (evita inflação por VIEW_PRODUCT/ADD_TO_CART)
  const horaMap = {};
  for (var h = 0; h < 24; h++) horaMap[h] = 0;
  filtradas.filter(function(r) { return r["Acao"] === "PAGE_VIEW"; }).forEach(function(r) {
    const n = normalizarDataHora(r["Timestamp"]);
    const partes = n ? n.split(" ") : [];
    if (partes.length >= 2) {
      const hora = Number(partes[1].split(":")[0]);
      if (!isNaN(hora)) horaMap[hora] = (horaMap[hora] || 0) + 1;
    }
  });
  const acessosPorHora = Object.entries(horaMap).map(function(e) { return { hora: Number(e[0]), total: e[1] }; });

  // Referrers: PAGE_VIEW onde Detalhe começa com "referrer:"
  const refMap = { direct: 0, instagram: 0, facebook: 0, google: 0, outros: 0 };
  filtradas.filter(function(r) { return r["Acao"] === "PAGE_VIEW"; }).forEach(function(r) {
    const d = String(r["Detalhe"] || "").toLowerCase();
    if (!d || d === "direct") refMap.direct++;
    else if (d.includes("instagram")) refMap.instagram++;
    else if (d.includes("facebook")) refMap.facebook++;
    else if (d.includes("google")) refMap.google++;
    else refMap.outros++;
  });
  const referrers = Object.entries(refMap).filter(function(e) { return e[1] > 0; }).map(function(e) { return { origem: e[0], total: e[1] }; });

  // Sessões únicas no período
  const sessaoSet = new Set();
  filtradas.forEach(function(r) { if (r["ID_Sessao"]) sessaoSet.add(r["ID_Sessao"]); });
  const totalSessoes = sessaoSet.size;

  return { metricas: { totalAcessos, totalProdutosVistos, totalCarrinhos, totalCheckouts, totalPedidos, acessosPorDia, topProdutos, acessosPorHora, referrers, totalSessoes } };
}

// ── MAPA DE VISITANTES — quem está de olho em quê ──────────────────────────
function getVisitorMap(p) {
  const diasLimit = Number((p && p.dias) || 30);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - diasLimit);

  const rows = sheetToObjects("Logs_Metricas") || [];

  // Identidades: vid → {nome, telefone} via CLIENT_IDENTIFY
  const vidIdentity = {};
  rows.forEach(function(r) {
    if (r["Acao"] === "CLIENT_IDENTIFY" && r["VID"]) {
      const pts = String(r["Detalhe"] || "").split("|");
      vidIdentity[r["VID"]] = { nome: pts[0] || "", telefone: pts[1] || "" };
    }
  });

  // Agrupa VIEW_PRODUCT por produto × vid
  const prodViews = {};
  rows.forEach(function(r) {
    if (r["Acao"] !== "VIEW_PRODUCT") return;
    const ts = r["Timestamp"] ? parseDateBR(normalizarDataHora(r["Timestamp"]).split(" ")[0]) : null;
    if (!ts || ts < cutoff) return;
    const pid = String(r["Detalhe"] || "");
    if (!pid) return;
    const vid = String(r["VID"] || "") || String(r["ID_Sessao"] || "?");
    if (!prodViews[pid]) prodViews[pid] = {};
    prodViews[pid][vid] = (prodViews[pid][vid] || 0) + 1;
  });

  const prods_ = sheetToObjects("Produtos");
  const prodIdx = {};
  prods_.forEach(function(pr) { if (pr["ID"]) prodIdx[String(pr["ID"])] = pr["Nome do Produto"] || pr["Nome"] || pr["ID"]; });

  const result = Object.entries(prodViews)
    .map(function(e) {
      const pid = e[0], vidMap = e[1];
      const viewers = Object.entries(vidMap)
        .sort(function(a, b) { return b[1] - a[1]; })
        .map(function(ve) {
          const vid = ve[0], count = ve[1];
          const id2 = vidIdentity[vid] || {};
          return { vid: vid, count: count, nome: id2.nome || "", telefone: id2.telefone || "" };
        });
      const totalViews = viewers.reduce(function(s, v) { return s + v.count; }, 0);
      return { id: pid, nome: prodIdx[pid] || pid, views: totalViews, viewers: viewers };
    })
    .sort(function(a, b) { return b.views - a.views; })
    .slice(0, 20);

  return { visitorMap: result };
}

// \u2500\u2500 FRETE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getFrete() {
  const rows = sheetToObjects("Frete");
  return { fretes: rows.filter(r => String(r["Ativo?"]).toLowerCase() === "sim") };
}

// \u2500\u2500 ADMIN LOGIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// BUG-06: execute migrarSenhaParaProperties() UMA VEZ após reimplantar para mover a senha
function migrarSenhaParaProperties() {
  const senhaAtual = getConfigValue("ADMIN_SENHA");
  if (!senhaAtual) return { error: "ADMIN_SENHA não encontrada na aba Config" };
  PropertiesService.getScriptProperties().setProperty("ADMIN_SENHA", senhaAtual);
  return { ok: true, msg: "Senha migrada. Você pode remover ADMIN_SENHA da planilha Config." };
}

// ── AUTH ADMIN/OPERADOR: token HMAC stateless + rate-limit por chave (CacheService) ──
// token = base64url(payload) + "." + base64url(HMAC_SHA256(payload, AUTH_SECRET))
// payload = papel|id|expiraMs
function _signAuthToken(papel, id) {
  const exp = Date.now() + 12 * 60 * 60 * 1000; // 12h
  const payload = papel + "|" + id + "|" + exp;
  const sig = Utilities.computeHmacSha256Signature(payload, _authSecret());
  return Utilities.base64EncodeWebSafe(payload) + "." + Utilities.base64EncodeWebSafe(sig);
}
function _verifyAuthToken(token, papel) {
  if (!token || token.indexOf(".") === -1) return null;
  try {
    const parts = token.split(".");
    const payload = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
    const expectSig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, _authSecret()));
    if (expectSig !== parts[1]) return null;   // assinatura inválida (forjado)
    const seg = payload.split("|");
    if (seg[0] !== papel) return null;          // papel errado
    if (Number(seg[2]) < Date.now()) return null; // expirado
    return seg[1];                               // id (admin = "1")
  } catch (e) { return null; }
}
function adminLoginId(token) { return _verifyAuthToken(token, "admin"); }
function operadorLoginId(token) { return _verifyAuthToken(token, "operador"); }

// Rate-limit de login: máx 5 tentativas por chave a cada 5 minutos.
function _loginRateOk(chave) {
  return Number(CacheService.getScriptCache().get("login_" + chave) || 0) < 5;
}
function _loginRateHit(chave) {
  const cache = CacheService.getScriptCache();
  const hits = Number(cache.get("login_" + chave) || 0) + 1;
  cache.put("login_" + chave, String(hits), 300); // 5 min
  return hits;
}
function _loginRateClear(chave) {
  CacheService.getScriptCache().remove("login_" + chave);
}

function adminLogin(p) {
  const senha = (p && p.senha) || "";
  const chave = String((p && p.ip) || "admin");
  if (!senha) return { ok: false, error: "Senha não informada" };
  if (!_loginRateOk(chave)) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  // BUG-06: lê de PropertiesService primeiro; fallback para Config durante transição
  const senhaCorreta = PropertiesService.getScriptProperties().getProperty("ADMIN_SENHA")
                    || getConfigValue("ADMIN_SENHA");
  if (!senhaCorreta) return { ok: false, error: "Senha não configurada" };
  if (senha !== senhaCorreta) {
    _loginRateHit(chave);
    return { ok: false, error: "Senha incorreta" };
  }
  _loginRateClear(chave);
  return { ok: true, token: _signAuthToken("admin", "1"), role: "admin" };
}

// \u2500\u2500 CATEGORIAS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getCategorias() {
  const rows = sheetToObjects("CONFIG_CATEGORIAS");
  return { categorias: rows };
}

function salvarCategoria(p) {
  let sh = getSheet("CONFIG_CATEGORIAS");
  if (!sh) {
    sh = SS.insertSheet("CONFIG_CATEGORIAS");
    sh.getRange(1, 1, 1, 5).setValues([["ID", "Nome", "Emoji", "Cor_Hex", "Status"]]);
  }
  const id = p.id || newId("CAT");
  const row = [id, p.nome || "", p.emoji || "\uD83D\uDCE6", p.cor || "#00e676", p.status || "Ativo"];
  const found = findRow("CONFIG_CATEGORIAS", 0, id);
  if (found) {
    found.sh.getRange(found.rowNum, 1, 1, row.length).setValues([row]);
    return { ok: true, action: "updated", id };
  }
  sh.appendRow(row);
  return { ok: true, action: "created", id };
}

// Garante que a coluna existe na aba Produtos. Retorna o índice 1-based.
function _ensureProdCol(col) {
  const sh = getSheet("Produtos");
  if (!sh) throw new Error("Aba Produtos não encontrada");
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const idx = headers.indexOf(col);
  if (idx === -1) {
    sh.getRange(1, sh.getLastColumn() + 1).setValue(col);
    return sh.getLastColumn();
  }
  return idx + 1;
}

// Inativa/reativa categoria EM CASCATA nos produtos.
// p = { id, nome, emoji, cor, status } — status = novo status alvo da categoria.
// Inativar  -> produtos ATIVOS da cat viram Inativo + flag Inativado_Por_Cat=TRUE.
// Reativar  -> volta Ativo SÓ onde flag=TRUE (não ressuscita inativado manual), limpa flag.
function toggleCategoria(p) {
  const catRes = salvarCategoria(p);
  if (catRes.error) return catRes;

  const nomeCat = String(p.nome || "").trim();
  const novoStatus = String(p.status || "Ativo");
  const sh = getSheet("Produtos");
  if (!sh) return { ok: true, categoria: catRes, afetados: 0 };

  _ensureProdCol("Inativado_Por_Cat");
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { ok: true, categoria: catRes, afetados: 0 };
  const headers = data[0];
  const iCat  = headers.indexOf("Categoria");
  const iStat = headers.indexOf("Status");
  const iFlag = headers.indexOf("Inativado_Por_Cat");
  if (iCat < 0 || iStat < 0 || iFlag < 0) return { ok: true, categoria: catRes, afetados: 0 };

  const n = data.length - 1;
  const colStat = sh.getRange(2, iStat + 1, n, 1).getValues();
  const colFlag = sh.getRange(2, iFlag + 1, n, 1).getValues();
  let afetados = 0;

  for (let i = 1; i < data.length; i++) {
    const j = i - 1;
    if (String(data[i][iCat]).trim() !== nomeCat) continue;
    if (novoStatus === "Inativo") {
      if (String(data[i][iStat]).toLowerCase() === "ativo") {
        colStat[j][0] = "Inativo"; colFlag[j][0] = true; afetados++;
      }
    } else {
      const flag = colFlag[j][0];
      if (flag === true || String(flag).toUpperCase() === "TRUE") {
        colStat[j][0] = "Ativo"; colFlag[j][0] = ""; afetados++;
      }
    }
  }
  sh.getRange(2, iStat + 1, n, 1).setValues(colStat);
  sh.getRange(2, iFlag + 1, n, 1).setValues(colFlag);
  _clearProdCache();
  return { ok: true, categoria: catRes, afetados: afetados, status: novoStatus };
}

function deletarCategoria(id) {
  const found = findRow("CONFIG_CATEGORIAS", 0, id);
  if (!found) return { error: "Categoria não encontrada" };
  const headers = getHeaders("CONFIG_CATEGORIAS");
  const col = headers.indexOf("Status") + 1;
  if (col > 0) found.sh.getRange(found.rowNum, col).setValue("Inativo");
  return { ok: true };
}

// \u2500\u2500 MORNING DIGEST \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function enviarMorningDigest() {
  const emailDest = getConfigValue("EMAIL_NOTIFICACAO");
  if (!emailDest) return { enviado: false, motivo: "EMAIL_NOTIFICACAO não configurado na aba Config" };
  const nomeLoja3 = getConfigValue("NOME_LOJA") || "GJ Store";

  const pedidos  = sheetToObjects("Pedidos") || [];
  const prods    = sheetToObjects("Produtos") || [];
  const carr     = sheetToObjects("CARRINHOS_ABANDONADOS") || [];
  const hoje     = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  const diasLim  = Number(getConfigValue("RECORRENCIA_ALERTA_DIAS") || "45");

  // Total previsto (vencimento hoje, não finalizado/cancelado)
  const pedHoje = pedidos.filter(p =>
    String(p["Data_Vencimento"] || "").startsWith(hoje) &&
    p["Status"] !== "Finalizado" && p["Status"] !== "Cancelado"
  );
  const totalPrevisto = pedHoje.reduce((s, p) => s + Number(p["Total (R$)"] || 0), 0);
  const totalFmt = "R$ " + totalPrevisto.toFixed(2).replace(".", ",");

  // Clientes sumidos
  const crmData = getCRM();
  const sumidos = (crmData.clientes || []).length;

  // Estoque em risco
  const estoqueRisco = prods.filter(p =>
    Number(p["Estoque"] || 0) <= 3 && String(p["Status"] || "").toLowerCase() === "ativo"
  );
  const nomesRisco = estoqueRisco.slice(0, 4).map(p => p["Nome do Produto"] || "").filter(Boolean).join(", ");

  // Carrinhos abandonados hoje
  const carrHoje = carr.filter(c => String(c["Data_Hora"] || "").startsWith(hoje));

  const htmlBody =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
  + "<body style='margin:0;padding:0;background:#04090f;font-family:Arial,sans-serif'>"
  + "<table width='100%' cellpadding='0' cellspacing='0' bgcolor='#04090f'><tr><td align='center' style='padding:24px 16px'>"
  + "<table width='560' cellpadding='0' cellspacing='0' style='max-width:560px'>"

  + "<tr><td align='center' style='background:#00e676;border-radius:14px 14px 0 0;padding:22px'>"
  + "<div style='font-size:28px;font-weight:900;color:#04090f;font-family:Arial Black,Arial'>" + nomeLoja3.toUpperCase() + "</div>"
  + "<div style='font-size:13px;font-weight:700;color:#04090f;margin-top:4px'>\uD83D\uDCCA MORNING DIGEST \u2014 " + hoje + "</div>"
  + "</td></tr>"

  + "<tr><td style='background:#060c18;padding:20px;border-left:1px solid #1a2840;border-right:1px solid #1a2840'>"
  + "<table width='100%' cellpadding='8' cellspacing='0'>"
  + "<tr>"
  + "<td style='background:#08111f;border-radius:10px;border:1px solid #1a2840;padding:14px;width:48%'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>PREVISTO HOJE</div>"
  + "<div style='font-size:22px;font-weight:900;color:#00e676'>" + totalFmt + "</div>"
  + "<div style='font-size:11px;color:#556;margin-top:2px'>" + pedHoje.length + " vencimento(s)</div>"
  + "</td><td style='width:4%'></td>"
  + "<td style='background:#08111f;border-radius:10px;border:1px solid #1a2840;padding:14px;width:48%'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>SUMIDOS (>" + diasLim + "d)</div>"
  + "<div style='font-size:22px;font-weight:900;color:#ff6d00'>" + sumidos + "</div>"
  + "<div style='font-size:11px;color:#556;margin-top:2px'>clientes sem comprar</div>"
  + "</td>"
  + "</tr>"
  + "<tr style='height:10px'></tr>"
  + "<tr>"
  + "<td style='background:#08111f;border-radius:10px;border:1px solid #f4433633;padding:14px;width:48%'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>RISCO DE ESTOQUE (\u22643)</div>"
  + "<div style='font-size:22px;font-weight:900;color:#f44336'>" + estoqueRisco.length + "</div>"
  + "<div style='font-size:11px;color:#556;margin-top:2px'>" + (nomesRisco || "Tudo OK") + "</div>"
  + "</td><td style='width:4%'></td>"
  + "<td style='background:#08111f;border-radius:10px;border:1px solid #1a2840;padding:14px;width:48%'>"
  + "<div style='font-size:10px;color:#667;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px'>CARRINHOS ABANDONADOS</div>"
  + "<div style='font-size:22px;font-weight:900;color:#00bcd4'>" + carrHoje.length + "</div>"
  + "<div style='font-size:11px;color:#556;margin-top:2px'>hoje · " + carr.length + " total</div>"
  + "</td>"
  + "</tr>"
  + "</table>"
  + "</td></tr>"

  + "<tr><td style='background:#060c18;padding:14px;text-align:center;border-left:1px solid #1a2840;border-right:1px solid #1a2840;border-bottom:1px solid #1a2840;border-radius:0 0 14px 14px'>"
  + "<div style='font-size:10px;color:#445'>" + nomeLoja3 + " · Morning Digest automático · " + hoje + "</div>"
  + "</td></tr>"

  + "</table></td></tr></table></body></html>";

  GmailApp.sendEmail(emailDest, "\uD83D\uDCCA Morning Digest " + nomeLoja3 + " \u2014 " + hoje, "", {
    htmlBody: htmlBody, name: nomeLoja3
  });
  return { enviado: true, motivo: "Digest matinal enviado" };
}

// \u2500\u2500 TEMAS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getTemas() {
  const sh = getSheet("CONFIG_TEMAS");
  if (!sh) return { temas: [
    { Tema_ID:"cyberpunk", Nome_Exibicao:"Cyberpunk Dark", Status:"Ativo" },
    { Tema_ID:"light", Nome_Exibicao:"Minimalist Light", Status:"Ativo" },
    { Tema_ID:"gold", Nome_Exibicao:"Gold Premium", Status:"Ativo" }
  ]};
  return { temas: sheetToObjects("CONFIG_TEMAS") };
}

// \u2500\u2500 SCORE DE CLIENTES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Lê da aba CLIENTES unificada; fallback para CLIENTES_SCORE (legado).
function getClientesScore() {
  const sh = getSheet("CLIENTES");
  if (sh) {
    const rows = sheetToObjects("CLIENTES");
    return { clientes: rows.map(function(r) {
      return {
        ID: r["ID_Cliente"], Nome: r["Nome"], WhatsApp: r["WhatsApp"],
        Score_Atual: r["Score_Atual"], Compras_No_Prazo: r["Compras_No_Prazo"],
        Compras_Com_Atraso: r["Compras_Com_Atraso"], Compras_Adiantadas: r["Compras_Adiantadas"],
        Total_Gasto_RS: r["Total_Gasto_RS"], Classificacao: r["Classificacao"]
      };
    })};
  }
  // Fallback legado
  if (!getSheet("CLIENTES_SCORE")) return { clientes: [] };
  return { clientes: sheetToObjects("CLIENTES_SCORE") };
}

// atualizarScore \u2014 CLIENTES é o primário; CLIENTES_SCORE só se CLIENTES não existir (legado).
function atualizarScore(nomeCliente, telefone, statusPagamento, diasAtraso) {
  if (!nomeCliente) return;

  const usaUnificada = !!getSheet("CLIENTES");

  if (usaUnificada) {
    // \u2500\u2500 Modo unificado: escreve direto em CLIENTES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const cliHeaders = getHeaders("CLIENTES");
    const tel = String(telefone || "").replace(/\D/g, "");
    const cliRows = sheetToObjects("CLIENTES");
    const cliIdx = cliRows.findIndex(function(c) {
      return tel ? String(c["WhatsApp"]||"").replace(/\D/g,"") === tel :
             (c["Nome"] || "").toLowerCase() === nomeCliente.toLowerCase();
    });

    let score = 1000, prazo = 0, atraso = 0, antec = 0;
    let cliFound = null;

    if (cliIdx >= 0) {
      const r = cliRows[cliIdx];
      score = Number(r["Score_Atual"] || 1000);
      prazo = Number(r["Compras_No_Prazo"] || 0);
      atraso = Number(r["Compras_Com_Atraso"] || 0);
      antec  = Number(r["Compras_Adiantadas"] || 0);
      cliFound = findRow("CLIENTES", 0, r["ID_Cliente"]);
    }

    if (statusPagamento === "Antecipado") { score += 30; antec++; }
    else if (statusPagamento === "No Prazo" || statusPagamento === "Em Dia") { score += 10; prazo++; }
    else if (String(statusPagamento).startsWith("Atrasado") && diasAtraso > 0) {
      score -= Math.min(Number(diasAtraso) * 15, 600); atraso++;
    }
    if (statusPagamento === "Cancelado") { score = 0; }
    score = Math.max(0, Math.min(1000, score));
    const classif = score >= 900 ? "Excelente" : score >= 600 ? "Regular" : "Risco";

    if (cliFound) {
      const colSc  = cliHeaders.indexOf("Score_Atual") + 1;
      const colPr  = cliHeaders.indexOf("Compras_No_Prazo") + 1;
      const colAt  = cliHeaders.indexOf("Compras_Com_Atraso") + 1;
      const colAn  = cliHeaders.indexOf("Compras_Adiantadas") + 1;
      const colCl  = cliHeaders.indexOf("Classificacao") + 1;
      if (colSc > 0) cliFound.sh.getRange(cliFound.rowNum, colSc).setValue(score);
      if (colPr > 0) cliFound.sh.getRange(cliFound.rowNum, colPr).setValue(prazo);
      if (colAt > 0) cliFound.sh.getRange(cliFound.rowNum, colAt).setValue(atraso);
      if (colAn > 0) cliFound.sh.getRange(cliFound.rowNum, colAn).setValue(antec);
      if (colCl > 0) cliFound.sh.getRange(cliFound.rowNum, colCl).setValue(classif);
    } else {
      // Cliente ainda não cadastrado em CLIENTES \u2014 cria entrada automática
      appendRowByHeaders("CLIENTES", {
        ID_Cliente: newId("CLI"), Nome: nomeCliente, WhatsApp: tel,
        Data_Cadastro: nowBR(), Score_Atual: score,
        Compras_No_Prazo: prazo, Compras_Com_Atraso: atraso, Compras_Adiantadas: antec,
        Total_Gasto_RS: 0, Classificacao: classif, Origem_Contato: "Auto_Score"
      });
    }
    return;
  }

  // \u2500\u2500 Modo legado: escreve em CLIENTES_SCORE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  let sh = getSheet("CLIENTES_SCORE");
  if (!sh) {
    sh = SS.insertSheet("CLIENTES_SCORE");
    sh.getRange(1, 1, 1, 9).setValues([[
      "ID", "Nome", "WhatsApp", "Score_Atual",
      "Compras_No_Prazo", "Compras_Com_Atraso", "Compras_Adiantadas",
      "Total_Gasto_RS", "Classificacao"
    ]]);
  }
  const headers = getHeaders("CLIENTES_SCORE");
  const nomeIdx = headers.indexOf("Nome");
  const found = findRow("CLIENTES_SCORE", nomeIdx >= 0 ? nomeIdx : 1, nomeCliente);
  let score = 1000, prazo = 0, atraso = 0, antec = 0;

  if (found) {
    score = Number(found.row[headers.indexOf("Score_Atual")] || 1000);
    prazo = Number(found.row[headers.indexOf("Compras_No_Prazo")] || 0);
    atraso = Number(found.row[headers.indexOf("Compras_Com_Atraso")] || 0);
    antec = Number(found.row[headers.indexOf("Compras_Adiantadas")] || 0);
  }

  if (statusPagamento === "Antecipado") { score += 30; antec++; }
  else if (statusPagamento === "No Prazo" || statusPagamento === "Em Dia") { score += 10; prazo++; }
  else if (String(statusPagamento).startsWith("Atrasado") && diasAtraso > 0) {
    score -= Math.min(Number(diasAtraso) * 15, 600); atraso++;
  }
  if (statusPagamento === "Cancelado") { score = 0; }
  score = Math.max(0, Math.min(1000, score));

  const classif = score >= 900 ? "Excelente" : score >= 600 ? "Regular" : "Risco";
  const row = [
    found ? found.row[0] : newId("CLI"),
    nomeCliente, telefone || "",
    score, prazo, atraso, antec, 0, classif
  ];
  if (found) {
    found.sh.getRange(found.rowNum, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
  }
}

// \u2500\u2500 OPERADORES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getOperadores() {
  if (!getSheet("OPERADORES")) return { operadores: [] };
  return { operadores: sheetToObjects("OPERADORES") };
}

function salvarOperador(p) {
  if (!p.nome || !String(p.nome).trim()) return { error: "Nome é obrigatório" };
  let sh = getSheet("OPERADORES");
  if (!sh) {
    sh = SS.insertSheet("OPERADORES");
    sh.getRange(1,1,1,8).setValues([["ID","Nome","Foto_URL","Cargo","Telefone","Email","Status","Data_Cadastro"]]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,8).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
  }
  const id = p.id || newId("OP");
  const row = [id, p.nome||"", p.fotoUrl||"", p.cargo||"", p.telefone||"", p.email||"", p.status||"Ativo", p.dataCadastro||nowBR()];
  if (p.id) {
    const found = findRow("OPERADORES", 0,p.id);
    if (found) { found.sh.getRange(found.rowNum, 1, 1, 8).setValues([row]); return { ok: true, id }; }
  }
  sh.appendRow(row);
  return { ok: true, id };
}

function deletarOperador(id, p) {
  if (!_checkAdmin(p)) return { ok: false, error: "Não autorizado" };
  const opFound = findRow("OPERADORES", 0,id);
  if (!opFound) return { ok: false, error: "Operador não encontrado" };
  const opRow = opFound.sh.getRange(opFound.rowNum, 1, 1, opFound.sh.getLastColumn()).getValues()[0];
  const headers = getHeaders("OPERADORES");
  const opNome = String(opRow[headers.indexOf("Nome")] || "").toLowerCase().trim();
  // Compara pelo nome do operador (Responsavel guarda nome, não ID)
  const pedidosOp = sheetToObjects("Pedidos").filter(function(p) {
    return (p["Responsavel"] || "").toLowerCase().trim() === opNome;
  });
  if (pedidosOp.length > 0) {
    const colStat = headers.indexOf("Status") + 1;
    if (colStat > 0) opFound.sh.getRange(opFound.rowNum, colStat).setValue("Inativo");
    return { ok: true, inativado: true, aviso: "Operador tem " + pedidosOp.length + " pedido(s) \u2014 foi inativado em vez de deletado." };
  }
  opFound.sh.deleteRow(opFound.rowNum);
  // Remove senha se existir
  try { PropertiesService.getScriptProperties().deleteProperty("OP_SENHA_" + id); } catch(e) { console.error("deletarOperador: limpar OP_SENHA_" + id + " → " + e.message); }
  return { ok: true };
}

function definirSenhaOperador(id, senha) {
  if (!id) return { error: "ID do operador não informado" };
  if (!senha || String(senha).trim().length < 4) return { error: "Senha deve ter no mínimo 4 caracteres" };
  if (!findRow("OPERADORES", 0,id)) return { error: "Operador não encontrado" };
  const props = PropertiesService.getScriptProperties();
  const salt = Utilities.getUuid().replace(/-/g, "").slice(0, 16);
  const hash = _bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "::" + String(senha).trim(), Utilities.Charset.UTF_8));
  props.setProperty("OP_SALT_" + id, salt);
  props.setProperty("OP_SENHA_" + id, "sha256:" + hash);
  return { ok: true };
}

function operadorLogin(id, senha) {
  if (!id || !senha) return { ok: false, error: "Dados inválidos" };
  const opFound = findRow("OPERADORES", 0,id);
  if (!opFound) return { ok: false, error: "Operador não encontrado" };
  const headers = getHeaders("OPERADORES");
  const opRow = opFound.sh.getRange(opFound.rowNum, 1, 1, opFound.sh.getLastColumn()).getValues()[0];
  const opNome = String(opRow[headers.indexOf("Nome")] || "");
  const opStatus = String(opRow[headers.indexOf("Status")] || "");
  if (opStatus === "Inativo") return { ok: false, error: "Operador inativo. Contate o administrador." };
  const props = PropertiesService.getScriptProperties();
  const stored = props.getProperty("OP_SENHA_" + id);
  if (!stored) return { ok: false, error: "Senha não configurada. Contate o administrador." };
  // Rate-limit por operador: máx 5 tentativas / 5min
  const cache = CacheService.getScriptCache();
  const hits = Number(cache.get("op_" + id) || 0);
  if (hits >= 5) return { ok: false, error: "Muitas tentativas. Tente novamente em alguns minutos." };
  let ok = false;
  if (String(stored).indexOf("sha256:") === 0) {
    const salt = props.getProperty("OP_SALT_" + id) || "";
    const hash = _bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + "::" + String(senha).trim(), Utilities.Charset.UTF_8));
    ok = ("sha256:" + hash) === String(stored);
  } else {
    // Migração automática de senha legada em texto puro → re-salva com hash
    ok = String(senha).trim() === String(stored);
    if (ok) definirSenhaOperador(id, String(senha).trim());
  }
  if (!ok) {
    cache.put("op_" + id, String(hits + 1), 300);
    return { ok: false, error: "Senha incorreta." };
  }
  cache.remove("op_" + id);
  return { ok: true, token: _signAuthToken("operador", id), opId: id, opNome: opNome };
}

// \u2500\u2500 KPIs CONSOLIDADOS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getKPIs() {
  try {
    const pedidos = sheetToObjects("Pedidos");
    const baixas  = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();
    const hojeStr = Utilities.formatDate(hoje, "America/Sao_Paulo", "dd/MM/yyyy");
    const paga = function(b) { return String(b["Status_Pagamento"] || "") !== "Pendente"; };

    // G4 (2026-08-03): Faturamento = dinheiro que ENTROU de verdade (baixas), não valor de pedido criado.
    // Antes fatHoje/fatAno somavam Total(R$) de QUALQUER pedido não-cancelado (inclusive Pendente/Em andamento) —
    // contava como faturamento venda que o cliente ainda nem pagou. Confirmado com o dono: faturamento = pago.
    const baixasHoje = baixas.filter(function(b) {
      const dt = normalizarDataHora(b["Data_Baixa_Efetiva"]);
      return !!dt && dt.split(" ")[0] === hojeStr && paga(b);
    });
    const baixasMes = baixas.filter(function(b) {
      const dt = normalizarDataHora(b["Data_Baixa_Efetiva"]);
      if (!dt) return false;
      const parts = dt.split(" ")[0].split("/");
      if (parts.length < 3) return false;
      return Number(parts[1]) - 1 === mesAtual && Number(parts[2]) === anoAtual && paga(b);
    });
    const baixasAno = baixas.filter(function(b) {
      const dt = normalizarDataHora(b["Data_Baixa_Efetiva"]);
      if (!dt) return false;
      const parts = dt.split(" ")[0].split("/");
      return parts.length >= 3 && Number(parts[2]) === anoAtual && paga(b);
    });
    const somaBaixas = function(arr) { return arr.reduce(function(s, b) { return s + Number(b["Valor_Final_Recebido"] || b["Valor_Original"] || 0); }, 0); };

    // Pedidos do mês/hoje/ano — usado p/ contagem + fallback (venda finalizada sem baixa registrada, ex: à vista)
    const pedidosMes = pedidos.filter(function(p) {
      const dt = normalizarDataHora(p["Data/Hora"]);
      if (!dt) return false;
      const parts = dt.split("/");
      if (parts.length < 2) return false;
      return Number(parts[1]) - 1 === mesAtual && (parts[2] && Number(parts[2].split(" ")[0]) === anoAtual);
    });
    const pedidosHojeArr = pedidos.filter(function(p) { return String(p["Data/Hora"] || "").startsWith(hojeStr); });
    const pedidosAno = pedidos.filter(function(p) {
      const dt = normalizarDataHora(p["Data/Hora"]);
      if (!dt) return false;
      const parts = dt.split("/");
      return parts.length >= 3 && Number(parts[2].split(" ")[0]) === anoAtual;
    });
    const finalizadosDe = function(arr) { return arr.filter(function(p) { return p["Status"] === "Finalizado"; }); };
    const somaTotalDe = function(arr) { return arr.reduce(function(s, p) { return s + Number(p["Total (R$)"] || 0); }, 0); };

    const fatMes  = somaBaixas(baixasMes);
    const fatHojeBaixas = somaBaixas(baixasHoje);
    const fatAnoBaixas  = somaBaixas(baixasAno);
    const fatMesFinal = fatMes > 0 ? fatMes : somaTotalDe(finalizadosDe(pedidosMes));
    const fatHoje      = fatHojeBaixas > 0 ? fatHojeBaixas : somaTotalDe(finalizadosDe(pedidosHojeArr));
    const fatAno        = fatAnoBaixas  > 0 ? fatAnoBaixas  : somaTotalDe(finalizadosDe(pedidosAno));

    const pedidosFinalizados = finalizadosDe(pedidosMes);
    const pedidosPendentes   = pedidos.filter(function(p) { return p["Status"] === "Pendente"; });

    // Ticket médio
    const ticketMedio = pedidosFinalizados.length > 0
      ? pedidosMes.filter(function(p) { return p["Status"] !== "Cancelado"; })
          .reduce(function(s, p) { return s + Number(p["Total (R$)"] || 0); }, 0) /
          pedidosMes.filter(function(p) { return p["Status"] !== "Cancelado"; }).length
      : 0;

    // Taxa de conversão = Finalizados / (Finalizados + Cancelados + Pendentes + Andamento) do mês
    const totalAtivos = pedidosMes.filter(function(p) { return p["Status"] !== "Cancelado"; }).length;
    const taxaConversao = totalAtivos > 0 ? (pedidosFinalizados.length / totalAtivos * 100) : 0;

    // Meta mensal
    const meta = Number(getConfigValue("META_MENSAL_RS") || 5000);

    // Produtos para custo/lucro
    const produtosKPI = sheetToObjects("Produtos") || [];
    const produtosMapKPI = {};
    produtosKPI.forEach(function(pr) { produtosMapKPI[String(pr["ID"] || "")] = pr; });

    // G4: custo de qualquer pedido NÃO cancelado (cobre parcelado ainda "Pendente"/"Em andamento" recebendo
    // baixa mensal — se fosse só "Finalizado" o custo ficaria zerado até quitar 100%, distorcendo a margem
    // pro lado oposto). Bug corrigido de verdade: custoAno antes incluía Cancelado, agora não inclui nenhum dos 3.
    const custoDe = function(arr) { return arr.filter(function(p) { return p["Status"] !== "Cancelado"; })
      .reduce(function(s, p) { return s + calcCustoPedido(p, produtosMapKPI); }, 0); };
    const custoMes  = custoDe(pedidosMes);
    const custoHoje = custoDe(pedidosHojeArr);
    const custoAno  = custoDe(pedidosAno);

    const lucroMes  = fatMesFinal - custoMes;
    const lucroHoje = fatHoje - custoHoje;
    const lucroAno  = fatAno - custoAno;
    const margemMes = fatMesFinal > 0 ? Number((lucroMes / fatMesFinal * 100).toFixed(1)) : 0;

    return {
      fatMes: fatMesFinal, fatHoje, pedidosMes: pedidosMes.length, pedidosFinalizados: pedidosFinalizados.length,
      pedidosPendentes: pedidosPendentes.length, ticketMedio, taxaConversao, meta,
      progresso: meta > 0 ? Math.min(100, fatMesFinal / meta * 100) : 0,
      custoMes, lucroMes, margemMes,
      fatAno, custoAno, lucroAno,
      custoHoje, lucroHoje
    };
  } catch(e) { return { error: e.message }; }
}

function calcCustoPedido(pedido, produtosMap) {
  try {
    const raw = String(pedido["Itens (JSON)"] || pedido["Itens"] || "");
    if (!raw || raw === "[]") return 0;
    const itens = JSON.parse(raw);
    if (!Array.isArray(itens)) return 0;
    return itens.reduce(function(sum, it) {
      const id = String(it.id || "");
      const nomeLower = String(it.nome || it.name || "").trim().toLowerCase();
      const prod = produtosMap[id] || Object.values(produtosMap).find(function(pr) {
        return String(pr["Nome do Produto"] || "").trim().toLowerCase() === nomeLower;
      });
      const custo = Number(prod ? (prod["Custo_Unitario"] || 0) : 0);
      return sum + custo * Number(it.qty || it.quantidade || 1);
    }, 0);
  } catch(e) { return 0; }
}

// D3: parser de itens (JSON novo + pipe legado) compartilhado entre getResumoPeriodo e getAnalytics
// Acumula qtd/faturamento por nome de produto em `mapa`. Mesmo comportamento das 2 cópias originais:
// fat soma o Total (R$) do pedido inteiro por CADA item distinto (não é rateio por unidade) — preservado de propósito.
function acumularItensPedido(pedido, mapa) {
  const raw = pedido["Itens (JSON)"] || pedido["Itens"] || "";
  const total = Number(pedido["Total (R$)"] || 0);
  let parsed = false;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      arr.forEach(function(it) {
        const nome = (it.nome || it.name || "").trim();
        const qty = Number(it.qty || it.quantidade || 1);
        if (nome) { if (!mapa[nome]) mapa[nome] = { qtd: 0, fat: 0 }; mapa[nome].qtd += qty; mapa[nome].fat += total; }
      });
      parsed = true;
    }
  } catch(e) { console.error("acumularItensPedido parse: " + e.message); }
  if (!parsed) {
    String(raw).split("|").forEach(function(item) {
      const m = item.trim().match(/^(.+?)\s+x(\d+)$/);
      const nome = m ? m[1].trim() : item.trim();
      const qty = m ? Number(m[2]) : 1;
      if (nome) { if (!mapa[nome]) mapa[nome] = { qtd: 0, fat: 0 }; mapa[nome].qtd += qty; mapa[nome].fat += total; }
    });
  }
}

// ══ RESUMO PERIODICO (DASHBOARD HOME) ══════════════════════════════════════════════════════════════════════
function getResumoPeriodo(p) {
  const periodo = p.periodo || "30";
  const hoje = new Date(); hoje.setHours(23,59,59,0);
  let dataInicio, dataFim = hoje;
  if (periodo === "custom" && p.dataInicio && p.dataFim) {
    dataInicio = parseDateBR(p.dataInicio); dataFim = parseDateBR(p.dataFim);
    if (dataFim) dataFim.setHours(23,59,59,0);
  } else {
    const diasMap = {"hoje":1,"7":7,"30":30,"90":90};
    const dias = diasMap[periodo] !== undefined ? diasMap[periodo] : 30;
    dataInicio = new Date(); dataInicio.setDate(dataInicio.getDate() - dias + 1); dataInicio.setHours(0,0,0,0);
  }
  if (!dataInicio || !dataFim) return { error: "Datas inválidas" };
  function inRange(dtStr) {
    if (!dtStr) return false;
    if (dtStr instanceof Date) return dtStr >= dataInicio && dtStr <= dataFim;
    const s = String(dtStr).trim();
    const parts = s.split(" ")[0].split("/");
    if (parts.length < 3) return false;
    const dt = new Date(Number(parts[2]),Number(parts[1])-1,Number(parts[0]));
    return dt >= dataInicio && dt <= dataFim;
  }

  const pedidos = sheetToObjects("Pedidos");
  const prods = sheetToObjects("Produtos") || [];
  const produtosMapRP = {};
  prods.forEach(function(pr) { produtosMapRP[String(pr["ID"] || "")] = pr; });
  const baixas = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];

  const hojeStr = Utilities.formatDate(new Date(), "America/Sao_Paulo", "dd/MM/yyyy");
  const pedsHoje = pedidos.filter(function(p) { return normalizarDataHora(p["Data/Hora"]).startsWith(hojeStr) && p["Status"] !== "Cancelado"; });
  const fatHoje = pedsHoje.reduce(function(s,p) { return s + Number(p["Total (R$)"] || 0); }, 0);
  const pendentesTotal = pedidos.filter(function(p) { return p["Status"] === "Pendente"; }).length;
  const estoqueBaixo = prods.filter(function(p) { return p["Estoque"] !== null && p["Estoque"] !== undefined && Number(p["Estoque"]) <= 3; });

  const pedsFilt = pedidos.filter(function(p) { return inRange(p["Data/Hora"]); });
  const baixasFilt = baixas.filter(function(b) { return inRange(b["Data_Baixa_Efetiva"]); });
  const fatPeriodo = baixasFilt.filter(function(b) { return b["Status_Pagamento"] !== "Pendente"; })
    .reduce(function(s,b) { return s + Number(b["Valor_Final_Recebido"] || b["Valor_Original"] || 0); }, 0);
  const fatPeriodoFallback = pedsFilt.filter(function(p) { return p["Status"] === "Finalizado"; })
    .reduce(function(s,p) { return s + Number(p["Total (R$)"] || 0); }, 0);
  const fatFinal = fatPeriodo > 0 ? fatPeriodo : fatPeriodoFallback;

  const finalizados = pedsFilt.filter(function(p) { return p["Status"] === "Finalizado"; });
  const ativos = pedsFilt.filter(function(p) { return p["Status"] !== "Cancelado"; });
  const ticketMedio = finalizados.length > 0
    ? ativos.reduce(function(s,p) { return s + Number(p["Total (R$)"] || 0); }, 0) / ativos.length : 0;
  const taxaConversao = ativos.length > 0 ? (finalizados.length / ativos.length * 100) : 0;

  const metaMensal = Number(getConfigValue("META_MENSAL_RS") || 5000);
  const diasNoPeriodo = Math.max(1, Math.round((dataFim - dataInicio) / 86400000) + 1);
  const meta = periodo === "30" ? metaMensal : metaMensal / 30 * diasNoPeriodo;
  const progresso = meta > 0 ? Math.min(100, fatFinal / meta * 100) : 0;

  const prodMap = {};
  finalizados.forEach(function(pd) { acumularItensPedido(pd, prodMap); });
  const topProdutos = Object.entries(prodMap).sort(function(a,b) { return b[1].qtd - a[1].qtd; }).slice(0,5)
    .map(function(e) { return { nome: e[0], qtd: e[1].qtd, fat: e[1].fat }; });

  const agora2 = new Date(); agora2.setHours(0,0,0,0);
  const em7 = new Date(agora2); em7.setDate(agora2.getDate() + 7);
  const em30 = new Date(agora2); em30.setDate(agora2.getDate() + 30);
  let prev7 = 0, prev7c = 0, prev30 = 0, prev30c = 0;
  pedidos.forEach(function(r) {
    if (r["Status"] === "Finalizado" || r["Status"] === "Cancelado") return;
    const dvNorm = normalizarDataHora(r["Data_Vencimento"]);
    if (!dvNorm) return;
    const dv = parseDateBR(dvNorm.split(" ")[0]); if (!dv) return;
    dv.setHours(0,0,0,0); const val = Number(r["Total (R$)"] || 0);
    if (dv >= agora2 && dv <= em7) { prev7c++; prev7 += val; }
    else if (dv > em7 && dv <= em30) { prev30c++; prev30 += val; }
  });

  const pedsRecentes = pedsFilt.slice(0,10).map(function(p) {
    return { id: p["ID Pedido"], cliente: p["Nome Cliente"], data: p["Data/Hora"], total: p["Total (R$)"], status: p["Status"] };
  });

  return {
    pedidosHoje: pedsHoje.length, faturamentoHoje: fatHoje,
    pendentesTotal, estoqueBaixo: estoqueBaixo.length,
    pedidosPeriodo: pedsFilt.length, pedidosFinalizados: finalizados.length,
    fatPeriodo: fatFinal,
    ticketMedio, taxaConversao: Number(taxaConversao.toFixed(1)),
    meta: Math.round(meta), progresso: Number(progresso.toFixed(1)),
    previsao7: { total: prev7, count: prev7c },
    previsao30: { total: prev30, count: prev30c },
    topProdutos, pedidosRecentes: pedsRecentes,
    custoPeriodo: (function() { return finalizados.reduce(function(s,pd) { return s + calcCustoPedido(pd, produtosMapRP); }, 0); })(),
    lucroPeriodo: (function() { var fat = fatFinal; var custo = finalizados.reduce(function(s,pd) { return s + calcCustoPedido(pd, produtosMapRP); }, 0); return fat - custo; })(),
    margemPct: (function() { var fat = fatFinal; var custo = finalizados.reduce(function(s,pd) { return s + calcCustoPedido(pd, produtosMapRP); }, 0); return fat > 0 ? Number(((fat - custo) / fat * 100).toFixed(1)) : 0; })()
  };
}

function salvarConfigValor(p) {
  if (!p.chave || p.valor === undefined) return { error: "chave e valor obrigatórios" };
  const sh = getSheet("Config");
  if (!sh) return { error: "Aba Config não encontrada" };
  const data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === p.chave) {
      sh.getRange(i + 1, 2).setValue(String(p.valor));
      return { ok: true, chave: p.chave, valor: String(p.valor) };
    }
  }
  appendRowByHeaders("Config", { Chave: p.chave, Valor: String(p.valor), Descricao: "" });
  return { ok: true, chave: p.chave, valor: String(p.valor), criado: true };
}

// ══ CUPOM DE REENGAJAMENTO ═══════════════════════════════════════════════════════════════════════════════════
function criarCupomReengajamento(p) {
  // Aceita p.codigo direto ou deriva de p.telefone (últimos 4 dígitos)
  var rawCode = p.codigo;
  if (!rawCode && p.telefone) {
    var tel4 = String(p.telefone).replace(/\D/g, "").slice(-4);
    rawCode = "VOLTEI" + tel4;
  }
  if (!rawCode) return { error: "Código ou telefone obrigatório" };
  const codigo = String(rawCode).trim().toUpperCase();
  const sh = getSheet("Cupons");
  if (!sh) return { error: "Aba Cupons não existe" };
  const rows = sh.getDataRange().getValues();
  const headers = rows[0];
  const codigoCol = headers.indexOf("Código");
  // Verifica se já existe
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][codigoCol] || "").trim().toUpperCase() === codigo) {
      // Atualiza para ativo
      const atoCol = headers.indexOf("Ativo?") + 1;
      if (atoCol > 0) sh.getRange(i + 1, atoCol).setValue("sim");
      return { ok: true, criado: false, codigo };
    }
  }
  const desconto = Number(getConfigValue("DESCONTO_REENGAJAMENTO_PORCENTO") || 10);
  const validade = new Date(); validade.setDate(validade.getDate() + 30);
  const validadeFmt = Utilities.formatDate(validade, "America/Sao_Paulo", "dd/MM/yyyy");
  sh.appendRow([codigo, "%", desconto, validadeFmt, 1, 0, 0, "sim"]);
  return { ok: true, criado: true, codigo, desconto };
}

// \u2500\u2500 CLIENTES \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getClientes(p) {
  const busca = p ? (p.busca || "") : "";

  // Enriquecer com dados de pedidos (totalGasto, ultimoPedido)
  const pedidos = sheetToObjects("Pedidos");
  const pedMap = {};
  pedidos.forEach(function(pd) {
    const tel = String(pd["Telefone"]||"").replace(/\D/g, "");
    if (!tel) return;
    if (!pedMap[tel]) pedMap[tel] = { pedidos: [], totalGasto: 0, ultimoPedido: null };
    pedMap[tel].pedidos.push(pd);
    pedMap[tel].totalGasto += Number(pd["Total (R$)"] || 0);
    if (!pedMap[tel].ultimoPedido || String(pd["Data/Hora"] || "") > String(pedMap[tel].ultimoPedido["Data/Hora"] || "")) {
      pedMap[tel].ultimoPedido = pd;
    }
  });

  // Usa aba CLIENTES unificada se existir E tiver dados (aba vazia cai no fallback de Pedidos)
  const cliSh = getSheet("CLIENTES");
  const cliRows = cliSh ? sheetToObjects("CLIENTES") : [];
  if (cliSh && cliRows.length > 0) {
    // A5: soft-delete via coluna Status — não mostrar cliente "excluído" por padrão
    let rows = p && p.verTodos === "1" ? cliRows : cliRows.filter(function(r) { return String(r["Status"] || "") !== "Inativo"; });
    if (busca) {
      const q = busca.toLowerCase();
      rows = rows.filter(function(r) {
        return (r["Nome"] || "").toLowerCase().includes(q) ||
               (r["WhatsApp"] || "").includes(busca);
      });
    }
    const lista = rows.map(function(c) {
      const tel = String(c["WhatsApp"]||"").replace(/\D/g, "");
      const info = pedMap[tel] || { pedidos: [], totalGasto: 0, ultimoPedido: null };
      const totalGasto = Math.max(Number(c["Total_Gasto_RS"] || 0), info.totalGasto);
      const out = Object.assign({}, c, {
        telefone: tel,
        nome: c["Nome"] || "",
        pedidos: info.pedidos,
        totalGasto: totalGasto,
        ultimoPedido: info.ultimoPedido,
        scoreAtual: Number(c["Score_Atual"] || 1000),
        classificacao: c["Classificacao"] || "Novo",
        temSenha: !!String(c["Senha_Hash"] || "").trim()
      });
      // NUNCA expor hash/salt ao front
      delete out["Senha_Hash"]; delete out["Salt"];
      return out;
    }).sort(function(a, b) { return b.totalGasto - a.totalGasto; });
    return { clientes: lista, fonte: "CLIENTES", total: lista.length };
  }

  // Fallback: deriva de Pedidos (legado \u2014 aba CLIENTES não criada ainda)
  const map = {};
  pedidos.forEach(function(pd) {
    const nome = (pd["Nome Cliente"] || "").trim();
    const tel  = String(pd["Telefone"]||"").replace(/\D/g, "");
    if (!nome && !tel) return;
    const key = tel || nome.toLowerCase().replace(/\s+/g, " ");
    if (!map[key]) map[key] = { nome, telefone: tel, pedidos: [], totalGasto: 0, ultimoPedido: null, scoreAtual: 1000, classificacao: "\u2014" };
    if (nome && nome.length > (map[key].nome || "").length) map[key].nome = nome;
    if (tel && !map[key].telefone) map[key].telefone = tel;
    map[key].pedidos.push(pd);
    map[key].totalGasto += Number(pd["Total (R$)"] || 0);
    if (!map[key].ultimoPedido || String(pd["Data/Hora"] || "") > String(map[key].ultimoPedido["Data/Hora"] || "")) {
      map[key].ultimoPedido = pd;
    }
  });
  let lista = Object.values(map).sort(function(a, b) { return b.totalGasto - a.totalGasto; });
  if (busca) {
    const q = busca.toLowerCase();
    lista = lista.filter(function(c) { return c.nome.toLowerCase().includes(q) || c.telefone.includes(busca); });
  }
  return { clientes: lista, fonte: "Pedidos", total: lista.length };
}

// \u2500\u2500 MENU DA PLANILHA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("\uD83D\uDECD\uFE0F GJ Store")
    .addItem("\uD83C\uDFA8 Formatar Planilha", "formatarPlanilhaCompleta")
    .addItem("\uD83D\uDD27 Normalizar Categorias dos Produtos", "normalizarCategorias")
    .addToUi();
}

// Normaliza coluna Categoria da aba Produtos para bater com CONFIG_CATEGORIAS.
function normalizarCategorias() {
  const catSh  = getSheet("CONFIG_CATEGORIAS");
  const prodSh = getSheet("Produtos");

  if (!catSh || !prodSh) {
    SpreadsheetApp.getUi().alert("Abas CONFIG_CATEGORIAS ou Produtos não encontradas.");
    return;
  }

  const catData    = catSh.getDataRange().getValues();
  const catHeaders = catData[0];
  var iNome   = catHeaders.indexOf("Nome");
  var iStatus = catHeaders.indexOf("Status");
  if (iNome === -1) {
    SpreadsheetApp.getUi().alert("Coluna 'Nome' não encontrada em CONFIG_CATEGORIAS.");
    return;
  }

  var catMap = {};
  catData.slice(1).forEach(function(r) {
    var status = iStatus >= 0 ? String(r[iStatus] || "Ativo") : "Ativo";
    if (status !== "Inativo") {
      var nome = String(r[iNome] || "").trim();
      if (nome) catMap[nome.toLowerCase()] = nome;
    }
  });

  const prodData    = prodSh.getDataRange().getValues();
  const prodHeaders = prodData[0];
  var iCat = prodHeaders.indexOf("Categoria");
  if (iCat === -1) {
    SpreadsheetApp.getUi().alert("Coluna 'Categoria' não encontrada em Produtos.");
    return;
  }

  var fixed = 0;
  for (var i = 1; i < prodData.length; i++) {
    var raw = String(prodData[i][iCat] || "").trim();
    var correto = catMap[raw.toLowerCase()];
    if (correto && correto !== raw) {
      prodSh.getRange(i + 1, iCat + 1).setValue(correto);
      fixed++;
    }
  }

  SpreadsheetApp.getUi().alert("\u2705 " + fixed + " produto(s) corrigido(s). Categorias normalizadas.");
}

// \u2500\u2500 FORMATAÇÃO COMPLETA DA PLANILHA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function formatarPlanilhaCompleta() {
  const BG   = "#0b1728";
  const FG   = "#00e676";
  const BG2  = "#060c18";
  const FG2  = "#00bcd4";

  const abas = [
    { nome: "Produtos",           bg: BG,  fg: FG  },
    { nome: "Pedidos",            bg: BG,  fg: FG  },
    { nome: "Financeiro_Fluxo",   bg: BG,  fg: FG2 },
    { nome: "Cupons",             bg: BG,  fg: FG  },
    { nome: "Config",             bg: BG,  fg: FG2 },
    { nome: "Banners",            bg: BG2, fg: FG  },
    { nome: "Fretes",             bg: BG2, fg: FG  },
    { nome: "Frete",              bg: BG2, fg: FG  },
    { nome: "Baixas",             bg: BG,  fg: FG2 },
    { nome: "Analytics",          bg: BG,  fg: FG2 },
    { nome: "Acessos_Log",        bg: BG2, fg: FG2 },
    { nome: "CARRINHOS_ABANDONADOS", bg: BG2, fg: "#ff6d00" },
    { nome: "Logs_Metricas",      bg: BG,  fg: FG  },
    { nome: "Base_Clientes",      bg: BG,  fg: FG  },
    { nome: "CLIENTES_SCORE",     bg: BG,  fg: FG  },
    { nome: "CONFIG_CATEGORIAS",  bg: BG,  fg: FG2 },
    { nome: "CONFIG_TEMAS",       bg: BG2, fg: FG  },
    { nome: "Configurações",      bg: BG,  fg: FG2 }
  ];

  const resultados = [];
  abas.forEach(({ nome, bg, fg }) => {
    const sh = getSheet(nome);
    if (!sh) return;
    const lastCol = sh.getLastColumn();
    const lastRow = sh.getLastRow();
    if (lastCol < 1) return;

    // Cabeçalho
    const hdr = sh.getRange(1, 1, 1, lastCol);
    hdr.setBackground(bg)
       .setFontColor(fg)
       .setFontWeight("bold")
       .setFontSize(10)
       .setVerticalAlignment("middle");

    // Altura da linha de cabeçalho
    sh.setRowHeight(1, 32);

    // Zebra nas linhas de dados
    if (lastRow > 1) {
      for (let r = 2; r <= Math.min(lastRow, 500); r++) {
        const rowBg = (r % 2 === 0) ? "#060c18" : "#08111f";
        sh.getRange(r, 1, 1, lastCol).setBackground(rowBg).setFontColor("#d0e8f0").setFontSize(10);
      }
    }

    sh.setFrozenRows(1);
    try { sh.autoResizeColumns(1, lastCol); } catch(e) {}
    resultados.push(nome);
  });

  return { ok: true, formatadas: resultados };
}

// \u2500\u2500 DASHBOARD NATIVO NA PLANILHA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// A4: 2\u00AA chamada sem flag expl\u00EDcita n\u00E3o destr\u00F3i a aba (podia ter sido customizada manualmente).
// A recorrente `atualizarDashboard()` (trigger 1h) j\u00E1 atualiza em cima sem apagar \u2014 essa aqui s\u00F3
// recria do zero se pedido de prop\u00F3sito.
function criarDashboardNativo(p) {
  const existente = getSheet("\uD83D\uDCCA Dashboard");
  if (existente && !(p && p.forcar === "1")) {
    return { ok: false, error: "Aba Dashboard j\u00E1 existe. Passe forcar=1 pra recriar do zero (perde customiza\u00E7\u00E3o manual)." };
  }
  if (existente) SS.deleteSheet(existente);
  const dash = SS.insertSheet("\uD83D\uDCCA Dashboard");
  SS.setActiveSheet(dash);
  SS.moveActiveSheet(1);
  dash.setTabColor("#00e676");

  // Carrega dados reais (sem fórmulas \u2014 evita erros de locale)
  const pedidos = sheetToObjects("Pedidos").map(function(r) {
    return Object.assign({}, r, { "Data/Hora": normalizarDataHora(r["Data/Hora"]) });
  });
  const produtos = sheetToObjects("Produtos");

  // \u2500\u2500 TÍTULO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  dash.getRange("A1:H1").merge()
      .setValue("\uD83D\uDCCA DASHBOARD \u2014 GJ STORE")
      .setBackground("#00e676").setFontColor("#04090f")
      .setFontWeight("bold").setFontSize(14)
      .setHorizontalAlignment("center").setVerticalAlignment("middle");
  dash.setRowHeight(1, 40);
  dash.getRange("A2:H2").merge()
      .setValue("Atualizado em: " + nowBR())
      .setBackground("#0b1728").setFontColor("#667788")
      .setFontSize(9).setHorizontalAlignment("center");

  // \u2500\u2500 TABELA 1: STATUS DOS PEDIDOS (linhas 4-9) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const hdStatus = dash.getRange("A4:C4");
  hdStatus.setValues([["Status","Qtd","Total R$"]])
          .setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");

  const statuses = ["Pendente","Em andamento","Finalizado","Cancelado"];
  const statusBg = {"Pendente":"#1a1e28","Em andamento":"#0d1e2e","Finalizado":"#0a1f14","Cancelado":"#1f0d0d"};
  let totalGeral = 0, totalFaturado = 0;

  statuses.forEach((s, i) => {
    const grupo = pedidos.filter(p => p["Status"] === s);
    const qtd   = grupo.length;
    const soma  = grupo.reduce((acc, p) => acc + safeNum(p["Total (R$)"]), 0);
    totalGeral += qtd;
    if (s === "Finalizado") totalFaturado = soma;
    const row = 5 + i;
    dash.getRange(row, 1, 1, 3).setValues([[s, qtd, soma]])
        .setBackground(statusBg[s]).setFontColor("#d0e8f0").setFontSize(10);
    dash.getRange(row, 3).setNumberFormat("R$ #,##0.00");
  });

  dash.getRange("A9:C9").setValues([["TOTAL", totalGeral, totalFaturado]])
      .setBackground("#0b1728").setFontColor("#00bcd4").setFontWeight("bold");
  dash.getRange("C9").setNumberFormat("R$ #,##0.00").setFontColor("#00e676");

  // \u2500\u2500 TABELA 2: FORMAS DE PAGAMENTO (linhas 11-17) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  dash.getRange("A11:B11").setValues([["Forma Pagamento","Qtd"]])
      .setBackground("#0b1728").setFontColor("#00bcd4").setFontWeight("bold");

  const formasMap = [
    { label: "PIX",        match: function(fp){ return fp === "PIX"; } },
    { label: "Cartão",     match: function(fp){ return fp.includes("Cartão") || fp.includes("Cartao"); } },
    { label: "Fiado/Carnê",match: function(fp){ return fp === "Fiado/Carnê" || fp === "Parcelado GJ" || fp === "Fiado" || fp === "Carnê"; } },
    { label: "Dinheiro",   match: function(fp){ return fp === "Dinheiro"; } },
    { label: "Boleto",     match: function(fp){ return fp === "Boleto"; } },
    { label: "Outros",     match: null }
  ];
  const formasKnown = formasMap.slice(0, -1);
  formasMap.forEach(function(f, i) {
    const qtd = f.match === null
      ? pedidos.filter(function(p){ const fp = p["Forma Pagamento"] || ""; return !formasKnown.some(function(k){ return k.match(fp); }); }).length
      : pedidos.filter(function(p){ return f.match(p["Forma Pagamento"] || ""); }).length;
    const row = 12 + i;
    dash.getRange(row, 1, 1, 2).setValues([[f.label, qtd]])
        .setBackground(i % 2 === 0 ? "#060c18" : "#08111f")
        .setFontColor("#d0e8f0").setFontSize(10);
  });

  // \u2500\u2500 TABELA 3: PRODUTOS EM RISCO (linhas 19-25) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  dash.getRange("A19:C19").setValues([["\u26A0 Produto","Estoque","Status"]])
      .setBackground("#1a0d0d").setFontColor("#f44336").setFontWeight("bold");

  const emRisco = produtos
    .filter(p => Number(p["Estoque"] || 0) <= 3 && String(p["Status"]||"").toLowerCase() === "ativo")
    .sort((a,b) => Number(a["Estoque"]||0) - Number(b["Estoque"]||0))
    .slice(0, 5);

  if (emRisco.length === 0) {
    dash.getRange("A20:C20").merge().setValue("\u2705 Sem alertas de estoque")
        .setBackground("#0a1f14").setFontColor("#00e676").setFontSize(10);
  } else {
    emRisco.forEach((p, i) => {
      const row = 20 + i;
      dash.getRange(row, 1, 1, 3)
          .setValues([[p["Nome do Produto"]||"", Number(p["Estoque"]||0), p["Status"]||""]])
          .setBackground(i % 2 === 0 ? "#150a0a" : "#1a0d0d")
          .setFontColor("#ffcccc").setFontSize(9);
    });
  }

  // \u2500\u2500 TABELA 4: PEDIDOS POR MÊS \u2014 colunas J-K (linhas 3-10) \u2500\u2500\u2500\u2500
  dash.getRange("J3:K3").setValues([["Mês","Pedidos"]])
      .setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");

  const agora = new Date();
  const mesesData2 = [];
  for (let m = 5; m >= 0; m--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - m, 1);
    const label = Utilities.formatDate(d, "America/Sao_Paulo", "MM/yyyy");
    const mmStr = Utilities.formatDate(d, "America/Sao_Paulo", "MM");
    const yyStr = Utilities.formatDate(d, "America/Sao_Paulo", "yy");
    const yyyyStr = Utilities.formatDate(d, "America/Sao_Paulo", "yyyy");
    const qtd = pedidos.filter(p => {
      const dh = String(p["Data/Hora"] || "").trim();
      // formato dd/MM/yy HH:mm  ou  dd/MM/yyyy HH:mm
      return (dh.substring(3,5) === mmStr && (dh.substring(6,8) === yyStr || dh.substring(6,10) === yyyyStr));
    }).length;
    mesesData2.push([label, qtd]);
  }

  mesesData2.forEach(([mes, qtd], i) => {
    const row = 4 + i;
    dash.getRange(row, 10, 1, 2).setValues([[mes, qtd]])
        .setBackground(i % 2 === 0 ? "#060c18" : "#08111f")
        .setFontColor("#d0e8f0").setFontSize(9);
  });

  // \u2500\u2500 WIDTHS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  dash.setColumnWidth(1, 200);
  dash.setColumnWidth(2, 80);
  dash.setColumnWidth(3, 140);
  dash.setColumnWidth(4, 20);
  dash.setColumnWidth(5, 380);
  dash.setColumnWidth(9, 20);
  dash.setColumnWidth(10, 100);
  dash.setColumnWidth(11, 80);

  // \u2500\u2500 TABELA 5: KPIs FINANCEIROS (linhas 27-31) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  dash.getRange("A27:C27").setValues([["\uD83D\uDCB0 KPIs FINANCEIROS","",""]])
      .setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold").setFontSize(10);

  var baixas = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];
  var fatReal = baixas.reduce(function(s, b){ return s + Number(b["Valor_Final_Recebido"] || 0); }, 0);
  var qtdBaixas = baixas.length;
  var pedsFin = pedidos.filter(function(p){ return p["Status"] === "Finalizado"; });
  var ticketMedio = pedsFin.length > 0
    ? pedsFin.reduce(function(s, p){ return s + safeNum(p["Total (R$)"]); }, 0) / pedsFin.length
    : 0;
  var pedsAberto = pedidos.filter(function(p){ return p["Status"] === "Pendente" || p["Status"] === "Em andamento"; });
  var totalAberto = pedsAberto.reduce(function(s, p){ return s + safeNum(p["Total (R$)"]); }, 0);

  var kpis = [
    ["\uD83D\uDCB3 Faturamento Recebido", qtdBaixas + " baixas", fatReal],
    ["\uD83C\uDFAF Ticket Médio (Finaliz.)", pedsFin.length + " pedidos", ticketMedio],
    ["\u23F3 Total em Aberto", pedsAberto.length + " pedidos", totalAberto]
  ];
  kpis.forEach(function(row, i) {
    var r = 28 + i;
    dash.getRange(r, 1, 1, 3).setValues([row])
        .setBackground(i % 2 === 0 ? "#060c18" : "#08111f")
        .setFontColor("#d0e8f0").setFontSize(10);
    dash.getRange(r, 3).setNumberFormat("R$ #,##0.00")
        .setFontColor(i === 2 ? "#ff6d00" : "#00e676");
  });

  // \u2500\u2500 GRÁFICO 1: PIZZA \u2014 STATUS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const pizzaChart = dash.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(dash.getRange("A4:B8"))
    .setPosition(3, 5, 0, 0)
    .setOption("title", "Pedidos por Status")
    .setOption("pieHole", 0.4)
    .setOption("width", 380).setOption("height", 240)
    .setOption("colors", ["#ff6d00","#00bcd4","#00e676","#f44336"])
    .build();
  dash.insertChart(pizzaChart);

  // \u2500\u2500 GRÁFICO 2: BARRA \u2014 FORMAS DE PAGAMENTO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const barChart = dash.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(dash.getRange("A11:B17"))
    .setPosition(11, 5, 0, 0)
    .setOption("title", "Formas de Pagamento")
    .setOption("width", 380).setOption("height", 210)
    .setOption("legend", { position: "none" })
    .setOption("colors", ["#00bcd4"])
    .build();
  dash.insertChart(barChart);

  // \u2500\u2500 GRÁFICO 3: LINHA \u2014 PEDIDOS POR MÊS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const lineChart = dash.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(dash.getRange("J3:K9"))
    .setPosition(19, 5, 0, 0)
    .setOption("title", "Pedidos por Mês (últimos 6 meses)")
    .setOption("width", 380).setOption("height", 210)
    .setOption("legend", { position: "none" })
    .setOption("colors", ["#00e676"])
    .setOption("lineWidth", 3).setOption("pointSize", 6)
    .build();
  dash.insertChart(lineChart);

  dash.setFrozenRows(2);

  // Cria trigger automático de atualização a cada 1 hora
  _criarTriggerDashboard();

  return { ok: true, msg: "Dashboard criado com 3 gráficos. Trigger horário ativado." };
}

// \u2500\u2500 ATUALIZA APENAS OS DADOS DO DASHBOARD (chamado pelo trigger) \u2500\u2500
function atualizarDashboard() {
  const dash = getSheet("\uD83D\uDCCA Dashboard");
  if (!dash) return; // Se a aba não existe, ignora

  const pedidos = sheetToObjects("Pedidos").map(function(r) {
    return Object.assign({}, r, { "Data/Hora": normalizarDataHora(r["Data/Hora"]) });
  });
  const produtos = sheetToObjects("Produtos");

  // Atualiza timestamp
  dash.getRange("A2:H2").setValue("Atualizado em: " + nowBR());

  // Tabela 1 \u2014 Status
  const statuses = ["Pendente","Em andamento","Finalizado","Cancelado"];
  let totalGeral = 0, totalFaturado = 0;
  statuses.forEach((s, i) => {
    const grupo = pedidos.filter(p => p["Status"] === s);
    const qtd   = grupo.length;
    const soma  = grupo.reduce((acc, p) => acc + safeNum(p["Total (R$)"]), 0);
    totalGeral += qtd;
    if (s === "Finalizado") totalFaturado = soma;
    dash.getRange(5 + i, 2).setValue(qtd);
    dash.getRange(5 + i, 3).setValue(soma);
  });
  dash.getRange("B9").setValue(totalGeral);
  dash.getRange("C9").setValue(totalFaturado);

  // Tabela 2 \u2014 Formas de pagamento (parcial match para Cartão/Fiado)
  var formasMap2 = [
    { label: "PIX",         match: function(fp){ return fp === "PIX"; } },
    { label: "Cartão",      match: function(fp){ return fp.includes("Cartão") || fp.includes("Cartao"); } },
    { label: "Fiado/Carnê", match: function(fp){ return fp === "Fiado/Carnê" || fp === "Parcelado GJ" || fp === "Fiado" || fp === "Carnê"; } },
    { label: "Dinheiro",    match: function(fp){ return fp === "Dinheiro"; } },
    { label: "Boleto",      match: function(fp){ return fp === "Boleto"; } },
    { label: "Outros",      match: null }
  ];
  var formasKnown2 = formasMap2.slice(0, -1);
  formasMap2.forEach(function(f, i) {
    var qtd = f.match === null
      ? pedidos.filter(function(p){ var fp = p["Forma Pagamento"] || ""; return !formasKnown2.some(function(k){ return k.match(fp); }); }).length
      : pedidos.filter(function(p){ return f.match(p["Forma Pagamento"] || ""); }).length;
    dash.getRange(12 + i, 2).setValue(qtd);
  });

  // Tabela 3 \u2014 Produtos em risco
  const emRisco = produtos
    .filter(p => Number(p["Estoque"] || 0) <= 3 && String(p["Status"]||"").toLowerCase() === "ativo")
    .sort((a,b) => Number(a["Estoque"]||0) - Number(b["Estoque"]||0))
    .slice(0, 5);

  // Limpa linhas 20-24 antes de reescrever
  dash.getRange("A20:C24").clearContent();
  if (emRisco.length === 0) {
    dash.getRange("A20:C20").merge().setValue("\u2705 Sem alertas de estoque");
  } else {
    emRisco.forEach((p, i) => {
      dash.getRange(20 + i, 1, 1, 3).setValues([
        [p["Nome do Produto"]||"", Number(p["Estoque"]||0), p["Status"]||""]
      ]);
    });
  }

  // Tabela 4 \u2014 Pedidos por mês (colunas J-K)
  const agora = new Date();
  for (let m = 5; m >= 0; m--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - m, 1);
    const label = Utilities.formatDate(d, "America/Sao_Paulo", "MM/yyyy");
    const mmStr = Utilities.formatDate(d, "America/Sao_Paulo", "MM");
    const yyStr = Utilities.formatDate(d, "America/Sao_Paulo", "yy");
    const yyyyStr = Utilities.formatDate(d, "America/Sao_Paulo", "yyyy");
    const qtd = pedidos.filter(p => {
      const dh = String(p["Data/Hora"] || "").trim();
      return dh.substring(3,5) === mmStr &&
             (dh.substring(6,8) === yyStr || dh.substring(6,10) === yyyyStr);
    }).length;
    const row = 4 + (5 - m);
    dash.getRange(row, 10).setValue(label);
    dash.getRange(row, 11).setValue(qtd);
  }

  // Tabela 5 \u2014 KPIs Financeiros (linhas 28-30)
  var baixas2 = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];
  var fatReal2 = baixas2.reduce(function(s, b){ return s + Number(b["Valor_Final_Recebido"] || 0); }, 0);
  var pedsFin2 = pedidos.filter(function(p){ return p["Status"] === "Finalizado"; });
  var ticketMedio2 = pedsFin2.length > 0
    ? pedsFin2.reduce(function(s, p){ return s + safeNum(p["Total (R$)"]); }, 0) / pedsFin2.length
    : 0;
  var pedsAberto2 = pedidos.filter(function(p){ return p["Status"] === "Pendente" || p["Status"] === "Em andamento"; });
  var totalAberto2 = pedsAberto2.reduce(function(s, p){ return s + safeNum(p["Total (R$)"]); }, 0);

  dash.getRange(28, 2).setValue(baixas2.length);
  dash.getRange(28, 3).setValue(fatReal2);
  dash.getRange(29, 2).setValue(pedsFin2.length + " pedidos");
  dash.getRange(29, 3).setValue(ticketMedio2);
  dash.getRange(30, 2).setValue(pedsAberto2.length + " pedidos");
  dash.getRange(30, 3).setValue(totalAberto2);
}

// \u2500\u2500 TRIGGER AUTOMÁTICO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _criarTriggerDashboard() {
  // Remove triggers antigos da mesma função
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "atualizarDashboard") {
      ScriptApp.deleteTrigger(t);
    }
  });
  // Cria trigger a cada 1 hora (alinhado à mensagem de retorno e econômico em cota)
  ScriptApp.newTrigger("atualizarDashboard")
    .timeBased()
    .everyHours(1)
    .create();
}

function criarTriggerDashboard() {
  _criarTriggerDashboard();
  return { ok: true, msg: "Trigger criado: atualizarDashboard a cada 1 hora" };
}

// Atualiza setupSheets para criar novas abas
function setupSheetsV2() {
  const base = setupSheets();
  const created = base.created || [];

  if (!getSheet("CONFIG_CATEGORIAS")) {
    const sh = SS.insertSheet("CONFIG_CATEGORIAS");
    sh.getRange(1, 1, 1, 5).setValues([["ID", "Nome", "Emoji", "Cor_Hex", "Status"]]);
    // Pré-popula com categorias padrão
    const defaults = [
      ["CAT1","Eletrônicos","\uD83D\uDCF1","#00bcd4","Ativo"],
      ["CAT2","iPhones Lacrados","\uD83D\uDCE6","#00e676","Ativo"],
      ["CAT3","iPhone","\uD83D\uDCF1","#00e676","Ativo"],
      ["CAT4","iPhones Seminovos","\uD83D\uDD04","#00bcd4","Ativo"],
      ["CAT5","Notebooks","\uD83D\uDCBB","#7c4dff","Ativo"],
      ["CAT6","Games","\uD83C\uDFAE","#ff6d00","Ativo"],
      ["CAT7","Fones de Ouvido","\uD83C\uDFA7","#00bcd4","Ativo"],
      ["CAT8","Casa","\uD83C\uDFE0","#26a69a","Ativo"],
      ["CAT9","Segurança","\uD83D\uDCF7","#f44336","Ativo"],
      ["CAT10","Informática","\uD83D\uDDA5\uFE0F","#5c6bc0","Ativo"],
      ["CAT11","Cabos e Carregadores","\uD83D\uDD0C","#ff6d00","Ativo"],
      ["CAT12","Outros","\uD83D\uDCE6","#78909c","Ativo"]
    ];
    sh.getRange(2, 1, defaults.length, 5).setValues(defaults);
    created.push("CONFIG_CATEGORIAS");
  }

  // CLIENTES_SCORE foi unificado em CLIENTES \u2014 não cria mais.

  if (!getSheet("CONFIG_TEMAS")) {
    const sh = SS.insertSheet("CONFIG_TEMAS");
    sh.getRange(1, 1, 1, 3).setValues([["Tema_ID","Nome_Exibicao","Status"]]);
    sh.getRange(2, 1, 3, 3).setValues([
      ["cyberpunk","Cyberpunk Dark","Ativo"],
      ["light","Minimalist Light","Ativo"],
      ["gold","Gold Premium","Ativo"]        // rebrand: botafogo \u2192 gold
    ]);
    created.push("CONFIG_TEMAS");
  }

  if (!getSheet("CARRINHOS_ABANDONADOS")) {
    const sh = SS.insertSheet("CARRINHOS_ABANDONADOS");
    sh.getRange(1, 1, 1, 5).setValues([["Data_Hora","Nome","Telefone","Itens","Total_RS"]]);
    created.push("CARRINHOS_ABANDONADOS");
  }

  if (!getSheet("Logs_Metricas")) {
    const sh = SS.insertSheet("Logs_Metricas");
    sh.getRange(1, 1, 1, 6).setValues([["Timestamp","ID_Sessao","Acao","Detalhe","Origem","Dispositivo"]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 6).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
    sh.autoResizeColumns(1, 6);
    created.push("Logs_Metricas");
  }

  // Base_Clientes foi unificado em CLIENTES \u2014 não cria mais.

  // Aba CLIENTES unificada (substitui Base_Clientes + CLIENTES_SCORE)
  if (!getSheet("CLIENTES")) {
    const sh = SS.insertSheet("CLIENTES");
    sh.getRange(1, 1, 1, 17).setValues([[
      "ID_Cliente","Nome","WhatsApp","Email","CPF_CNPJ","Endereco","CEP",
      "Cidade","Estado","Data_Cadastro","Score_Atual",
      "Compras_No_Prazo","Compras_Com_Atraso","Compras_Adiantadas",
      "Total_Gasto_RS","Classificacao","Origem_Contato"
    ]]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, 17).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
    sh.autoResizeColumns(1, 17);
    created.push("CLIENTES");
  }

  if (!getSheet("OPERADORES")) {
    const sh = SS.insertSheet("OPERADORES");
    sh.getRange(1,1,1,8).setValues([["ID","Nome","Foto_URL","Cargo","Telefone","Email","Status","Data_Cadastro"]]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,8).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
    sh.autoResizeColumns(1, 8);
    created.push("OPERADORES");
  }

  return { ok: true, created };
}

// \u2500\u2500 SALVAR CLIENTE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function salvarCliente(p) {
  let sh = getSheet("CLIENTES");
  if (!sh) {
    sh = SS.insertSheet("CLIENTES");
    sh.getRange(1,1,1,17).setValues([[
      "ID_Cliente","Nome","WhatsApp","Email","CPF_CNPJ","Endereco","CEP",
      "Cidade","Estado","Data_Cadastro","Score_Atual",
      "Compras_No_Prazo","Compras_Com_Atraso","Compras_Adiantadas",
      "Total_Gasto_RS","Classificacao","Origem_Contato"
    ]]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,17).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
  }
  const tel = (p.whatsapp || p["WhatsApp"] || "").replace(/\D/g, "");
  let found = null;
  if (p.id) found = findRow("CLIENTES", 0, p.id);
  if (!found && tel) {
    const rows = sheetToObjects("CLIENTES");
    const ex = rows.find(function(r) { return String(r["WhatsApp"]||"").replace(/\D/g,"") === tel; });
    if (ex) found = findRow("CLIENTES", 0, ex["ID_Cliente"]);
  }
  const id = found ? found.row[0] : (p.id || newId("CLI"));
  const row = [
    id, p.nome || p["Nome"] || "", tel,
    p.email || p["Email"] || "", p.cpf || p["CPF_CNPJ"] || "",
    p.endereco || p["Endereco"] || "", p.cep || p["CEP"] || "",
    p.cidade || p["Cidade"] || "", p.estado || p["Estado"] || "",
    found ? (found.row[9] || nowBR()) : nowBR(),
    Number(p.scoreAtual || p["Score_Atual"] || 1000),
    Number(p.comprasNoPrazo || p["Compras_No_Prazo"] || 0),
    Number(p.comprasComAtraso || p["Compras_Com_Atraso"] || 0),
    Number(p.comprasAdiantadas || p["Compras_Adiantadas"] || 0),
    Number(p.totalGastoRs || p["Total_Gasto_RS"] || 0),
    p.classificacao || p["Classificacao"] || "Novo",
    p.origemContato || p["Origem_Contato"] || "Manual_Admin"
  ];
  if (found) {
    sh.getRange(found.rowNum, 1, 1, row.length).setValues([row]);
    return { ok: true, action: "updated", id };
  }
  sh.appendRow(row);
  return { ok: true, action: "created", id };
}

// \u2500\u2500 DELETAR CLIENTE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// A5 (2026-08-03): CLIENTES nunca tinha coluna "Status" no schema padrão (migrarAbas) — o soft-delete
// abaixo nunca disparava de verdade, sempre caía no deleteRow físico. Agora cria a coluna se faltar,
// igual ao padrão de _ensureAuthCols — soft-delete de fato, mantém histórico.
function deletarCliente(id, p) {
  if (!_checkAdmin(p)) return { ok: false, erro: "Não autorizado" };
  const found = findRow("CLIENTES", 0, id);
  if (!found) return { ok: false, error: "Cliente não encontrado" };
  let headers = getHeaders("CLIENTES");
  let col = headers.indexOf("Status");
  if (col === -1) {
    found.sh.getRange(1, found.sh.getLastColumn() + 1).setValue("Status");
    headers = getHeaders("CLIENTES");
    col = headers.indexOf("Status");
  }
  found.sh.getRange(found.rowNum, col + 1).setValue("Inativo");
  registrarAcao(p && p.operador, "deletarCliente", "Cliente", id, "soft-delete → Status=Inativo");
  return { ok: true, inativado: true };
}

// \u2500\u2500 IMPORTAR CONTATOS (lote) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function importarContatos(p) {
  let contatos = [];
  try { contatos = JSON.parse(p.contatos || "[]"); } catch(e) { return { error: "JSON inválido: " + e.message }; }
  if (!Array.isArray(contatos)) return { error: "contatos deve ser array" };
  let sh = getSheet("CLIENTES");
  if (!sh) {
    sh = SS.insertSheet("CLIENTES");
    sh.getRange(1,1,1,17).setValues([[
      "ID_Cliente","Nome","WhatsApp","Email","CPF_CNPJ","Endereco","CEP",
      "Cidade","Estado","Data_Cadastro","Score_Atual",
      "Compras_No_Prazo","Compras_Com_Atraso","Compras_Adiantadas",
      "Total_Gasto_RS","Classificacao","Origem_Contato"
    ]]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,17).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
  }
  const existing = sheetToObjects("CLIENTES").map(function(r){return String(r["WhatsApp"]||"").replace(/\D/g,"");}).filter(Boolean);
  let importados = 0, duplicados = 0, ignorados = 0;
  contatos.forEach(function(c) {
    const tel = (c.whatsapp || c.telefone || "").replace(/\D/g,"");
    const nome = (c.nome || "").trim();
    if (!nome && !tel) { ignorados++; return; }
    if (tel && existing.includes(tel)) { duplicados++; return; }
    appendRowByHeaders("CLIENTES", {
      ID_Cliente: newId("CLI"), Nome: nome, WhatsApp: tel,
      Data_Cadastro: nowBR(), Score_Atual: 1000,
      Classificacao: "Novo", Origem_Contato: "Importacao_Contato"
    });
    if (tel) existing.push(tel);
    importados++;
  });
  return { ok: true, importados, duplicados, ignorados };
}

// \u2500\u2500 PARCELAS DE UM PEDIDO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function getParcelasPedido(idPedido) {
  if (!idPedido) return { error: "idPedido obrigatório" };
  const sh = getSheet("Financeiro_Fluxo");
  if (!sh) return { parcelas: [], resumo: {} };
  const rows = sheetToObjects("Financeiro_Fluxo");
  const parcelas = rows
    .filter(function(r) { return String(r["ID_Pedido"] || "") === String(idPedido); })
    .map(function(r, i) {
      return {
        id: r["ID_Baixa"] || "",
        numParcela: i + 1,
        valor: Number(r["Valor_Original"] || 0),
        valorPago: Number(r["Valor_Final_Recebido"] || 0),
        status: r["Status_Pagamento"] || "Pendente",
        vencimento: r["Proxima_Vencimento"] || "",
        dataPagamento: r["Data_Baixa_Efetiva"] || "",
        saldoRestante: Number(r["Saldo_Restante"] || 0),
        diasAtraso: Number(r["Dias_Atraso"] || 0),
        taxaRS: Number(r["Taxa_Aplicada_RS"] || 0),
        nomeCliente: r["Nome_Cliente"] || "",
        telefone: r["Telefone"] || ""
      };
    });
  const statusPagos = ["Pago", "Antecipado", "No Prazo", "Em Dia"];
  const totalPedido = parcelas.reduce(function(s,p){return s+p.valor;},0);
  const totalPago   = parcelas.filter(function(p){return statusPagos.includes(p.status);}).reduce(function(s,p){return s+p.valorPago;},0);
  const pendentes   = parcelas.filter(function(p){return p.status==="Pendente"||String(p.status).startsWith("Atrasado");});
  const totalPendente = pendentes.reduce(function(s,p){return s+(p.saldoRestante>0?p.saldoRestante:p.valor);},0);
  const parcelasPagas = parcelas.filter(function(p){return statusPagos.includes(p.status);}).length;
  const proximaVencimento = pendentes.map(function(p){return p.vencimento;}).filter(Boolean).sort()[0]||"";
  return {
    parcelas,
    resumo:{totalPedido,totalPago,totalPendente:Math.max(0,totalPendente),parcelasPagas,totalParcelas:parcelas.length,proximaVencimento}
  };
}

// \u2500\u2500 ANALYTICS COM FILTRO DE PERÍODO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// N13: lucro agregado por produto/categoria, cruzando Itens (JSON) de cada pedido com
// Custo_Unitario/Categoria cadastrados em Produtos (casamento por nome, normalizado).
// Produto sem custo configurado entra com custo=0 (lucro=receita) - sinalizado em `semCusto`
// pra nao passar a impressao enganosa de 100% de margem quando e so falta de cadastro.
function _normNome(s) {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function getLucroPorProduto(p) {
  const statusExcluir = ["Cancelado", "Deletado"];
  const pedidos = sheetToObjects("Pedidos").filter(function(r) { return statusExcluir.indexOf(r["Status"]) === -1; });
  const produtos = sheetToObjects("Produtos");
  const custoPorNome = {}, catPorNome = {}, temCadastro = {};
  produtos.forEach(function(prod) {
    const key = _normNome(prod["Nome do Produto"]);
    if (!key) return;
    custoPorNome[key] = Number(prod["Custo_Unitario"] || 0);
    catPorNome[key] = prod["Categoria"] || "Sem categoria";
    temCadastro[key] = true;
  });

  const porProduto = {}, porCategoria = {};
  pedidos.forEach(function(ped) {
    let itens;
    try { itens = JSON.parse(ped["Itens (JSON)"] || "[]"); } catch (e) { return; }
    if (!Array.isArray(itens)) return;
    itens.forEach(function(it) {
      const nome = String(it.nome || it.name || "").trim();
      if (!nome) return;
      const key = _normNome(nome);
      const qtd = Number(it.qtd || it.qty || 1);
      const valorUnit = Number(it.valor || it.preco || 0);
      const receita = valorUnit * qtd;
      const custoUnit = custoPorNome[key] || 0;
      const custo = custoUnit * qtd;
      const cat = catPorNome[key] || "Sem categoria";
      const semCusto = !temCadastro[key] || custoUnit === 0;

      if (!porProduto[nome]) porProduto[nome] = { nome: nome, receita: 0, custo: 0, qtd: 0, semCusto: false };
      porProduto[nome].receita += receita;
      porProduto[nome].custo += custo;
      porProduto[nome].qtd += qtd;
      if (semCusto) porProduto[nome].semCusto = true;

      if (!porCategoria[cat]) porCategoria[cat] = { categoria: cat, receita: 0, custo: 0, qtd: 0, semCusto: false };
      porCategoria[cat].receita += receita;
      porCategoria[cat].custo += custo;
      porCategoria[cat].qtd += qtd;
      if (semCusto) porCategoria[cat].semCusto = true;
    });
  });

  const toArr = function(obj) {
    return Object.keys(obj).map(function(k) {
      const x = obj[k];
      x.lucro = x.receita - x.custo;
      x.margem = x.receita > 0 ? Number((x.lucro / x.receita * 100).toFixed(1)) : 0;
      return x;
    }).sort(function(a, b) { return b.lucro - a.lucro; });
  };

  return { ok: true, produtos: toArr(porProduto), categorias: toArr(porCategoria) };
}

function getAnalytics(p) {
  const periodo = p.periodo || "30d";
  const hoje = new Date(); hoje.setHours(23,59,59,0);
  let dataInicio = new Date(), dataFim = hoje;
  if (periodo === "custom" && p.dataInicio && p.dataFim) {
    dataInicio = parseDateBR(p.dataInicio); dataFim = parseDateBR(p.dataFim);
    if (dataFim) dataFim.setHours(23,59,59,0);
  } else {
    const diasMap = {"hoje":0,"7d":7,"30d":30,"90d":90,"7":7,"30":30,"90":90,"1":1};
    dataInicio.setDate(dataInicio.getDate()-(diasMap[periodo]!==undefined?diasMap[periodo]:30));
    dataInicio.setHours(0,0,0,0);
  }
  if (!dataInicio || !dataFim) return { error: "Datas inválidas" };
  function noRange(dtStr) {
    if (!dtStr) return false;
    if (dtStr instanceof Date) return dtStr >= dataInicio && dtStr <= dataFim;
    const s = String(dtStr).trim();
    const parts = s.split(" ")[0].split("/");
    if (parts.length < 3) return false;
    const dt = new Date(Number(parts[2]),Number(parts[1])-1,Number(parts[0]));
    return dt >= dataInicio && dt <= dataFim;
  }
  const pedidos = sheetToObjects("Pedidos");
  const baixas  = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];
  const pedsFilt = pedidos.filter(function(pd){return noRange(pd["Data/Hora"]);});
  const baixasFilt = baixas.filter(function(b){return noRange(b["Data_Baixa_Efetiva"]);});
  const fatPeriodo = baixasFilt.filter(function(b){return b["Status_Pagamento"]!=="Pendente"&&b["Status_Pagamento"]!=="Liquidado";})
    .reduce(function(s,b){return s+Number(b["Valor_Final_Recebido"]||0);},0);
  const finalizados = pedsFilt.filter(function(pd){return pd["Status"]==="Finalizado";});
  const ticketMedio = finalizados.length>0?finalizados.reduce(function(s,pd){return s+Number(pd["Total (R$)"]||0);},0)/finalizados.length:0;
  const fpMap = {};
  pedsFilt.forEach(function(pd){const fp=pd["Forma Pagamento"]||"Outros";fpMap[fp]=(fpMap[fp]||0)+1;});
  const formasPagamento = Object.entries(fpMap).map(function(e){return{forma:e[0],qtd:e[1]};}).sort(function(a,b){return b.qtd-a.qtd;});
  const prodMap = {};
  finalizados.forEach(function(pd){ acumularItensPedido(pd, prodMap); });
  const topProdutos = Object.entries(prodMap).sort(function(a,b){return b[1].qtd-a[1].qtd;}).slice(0,10)
    .map(function(e){return{nome:e[0],qtd:e[1].qtd,faturamento:e[1].fat};});
  const diaFatMap = {};
  baixasFilt.filter(function(b){return b["Status_Pagamento"]!=="Pendente"&&b["Status_Pagamento"]!=="Liquidado";})
    .forEach(function(b){const dt=normalizarDataHora(b["Data_Baixa_Efetiva"]).split(" ")[0];if(dt)diaFatMap[dt]=(diaFatMap[dt]||0)+Number(b["Valor_Final_Recebido"]||0);});
  const faturamentoDiario = Object.entries(diaFatMap).sort(function(a,b){return a[0].localeCompare(b[0]);})
    .map(function(e){return{data:e[0],valor:e[1]};});
  const pedsPorMes = {};
  pedidos.forEach(function(pd){const parts=normalizarDataHora(pd["Data/Hora"]).split(" ")[0].split("/");if(parts.length<3)return;const k=parts[1]+"/"+parts[2];pedsPorMes[k]=(pedsPorMes[k]||0)+1;});
  const pedidosPorMes = Object.entries(pedsPorMes).sort(function(a,b){return a[0].localeCompare(b[0]);}).slice(-6).map(function(e){return{mes:e[0],qtd:e[1]};});
  const totalClientes = getSheet("CLIENTES") ? (getSheet("CLIENTES").getLastRow()-1) : 0;
  const meta = Number(getConfigValue("META_MENSAL_RS")||5000);
  const agora2=new Date();agora2.setHours(0,0,0,0);
  const em7=new Date(agora2);em7.setDate(agora2.getDate()+7);
  const em30=new Date(agora2);em30.setDate(agora2.getDate()+30);
  let prev7=0, prev30=0;
  baixas.filter(function(b){return b["Status_Pagamento"]==="Pendente";}).forEach(function(b){
    const dv=parseDateBR(normalizarDataHora(b["Proxima_Vencimento"]).split(" ")[0]);if(!dv)return;
    dv.setHours(0,0,0,0);
    const val=Number(b["Saldo_Restante"]||b["Valor_Original"]||0);
    if(dv>=agora2&&dv<=em7)prev7+=val;else if(dv>em7&&dv<=em30)prev30+=val;
  });
  return {
    faturamento:{atual:fatPeriodo,meta,progresso:meta>0?Math.min(100,fatPeriodo/meta*100):0},
    pedidos:{total:pedsFilt.length,finalizados:finalizados.length,
      pendentes:pedsFilt.filter(function(pd){return pd["Status"]==="Pendente";}).length,
      andamento:pedsFilt.filter(function(pd){return pd["Status"]==="Em andamento";}).length,
      cancelados:pedsFilt.filter(function(pd){return pd["Status"]==="Cancelado";}).length},
    ticketMedio,formasPagamento,topProdutos,faturamentoDiario,pedidosPorMes,
    clientes:{total:totalClientes},
    previsaoCaixa:{"7dias":prev7,"30dias":prev30}
  };
}

// \u2500\u2500 MIGRAR ABAS (executar UMA VEZ) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function migrarAbas() {
  const log = [];
  let cliSh = getSheet("CLIENTES");
  if (!cliSh) {
    cliSh = SS.insertSheet("CLIENTES");
    cliSh.getRange(1,1,1,17).setValues([[
      "ID_Cliente","Nome","WhatsApp","Email","CPF_CNPJ","Endereco","CEP",
      "Cidade","Estado","Data_Cadastro","Score_Atual",
      "Compras_No_Prazo","Compras_Com_Atraso","Compras_Adiantadas",
      "Total_Gasto_RS","Classificacao","Origem_Contato"
    ]]);
    cliSh.setFrozenRows(1);
    cliSh.getRange(1,1,1,17).setBackground("#0b1728").setFontColor("#00e676").setFontWeight("bold");
    cliSh.autoResizeColumns(1,17);
    log.push("CLIENTES criada");
  }
  function normTel(v) { return String(v||"").replace(/\D/g,""); }
  function getTelsCLI() {
    return sheetToObjects("CLIENTES").map(function(r){return normTel(r["WhatsApp"]);}).filter(Boolean);
  }
  // Migra Base_Clientes
  const baseSh = getSheet("Base_Clientes");
  if (baseSh) {
    const baseRows = sheetToObjects("Base_Clientes");
    const tels = getTelsCLI();
    let imp = 0;
    baseRows.forEach(function(r) {
      const tel = normTel(r["WhatsApp"]);
      if (tel && tels.includes(tel)) return;
      appendRowByHeaders("CLIENTES", {
        ID_Cliente: r["ID_Cliente"] || newId("CLI"), Nome: r["Nome"] || "", WhatsApp: tel,
        Email: r["Email"] || "", CPF_CNPJ: r["CPF_CNPJ"] || "",
        Endereco: r["Endereco"] || "", CEP: r["CEP"] || "", Cidade: r["Cidade"] || "", Estado: r["Estado"] || "",
        Data_Cadastro: r["Data_Cadastro"] || r["Data_Primeiro_Acesso"] || nowBR(),
        Score_Atual: 1000,
        Total_Gasto_RS: Number(r["Total_Compras_RS"] || r["Total_Gasto_RS"] || 0),
        Classificacao: r["Classificacao"] || "Novo", Origem_Contato: "Importacao_Contato"
      });
      if(tel)tels.push(tel);imp++;
    });
    log.push("Base_Clientes: "+imp+" migrados");
  }
  // Merge CLIENTES_SCORE
  const scoreSh = getSheet("CLIENTES_SCORE");
  if (scoreSh) {
    const scoreRows = sheetToObjects("CLIENTES_SCORE");
    const cliHeaders = getHeaders("CLIENTES");
    let atualiz=0,novos=0;
    scoreRows.forEach(function(s) {
      const tel=normTel(s["WhatsApp"]);
      const cliRows=sheetToObjects("CLIENTES");
      const idx=cliRows.findIndex(function(c){return tel?normTel(c["WhatsApp"])===tel:(c["Nome"]||"").toLowerCase()===(s["Nome"]||"").toLowerCase();});
      if(idx>=0){
        const cf=findRow("CLIENTES",0,cliRows[idx]["ID_Cliente"]);
        if(cf){
          const cs=cliHeaders.indexOf("Score_Atual")+1,cp=cliHeaders.indexOf("Compras_No_Prazo")+1,
                ca=cliHeaders.indexOf("Compras_Com_Atraso")+1,can=cliHeaders.indexOf("Compras_Adiantadas")+1,
                cc=cliHeaders.indexOf("Classificacao")+1;
          if(cs>0)cf.sh.getRange(cf.rowNum,cs).setValue(Number(s["Score_Atual"]||1000));
          if(cp>0)cf.sh.getRange(cf.rowNum,cp).setValue(Number(s["Compras_No_Prazo"]||0));
          if(ca>0)cf.sh.getRange(cf.rowNum,ca).setValue(Number(s["Compras_Com_Atraso"]||0));
          if(can>0)cf.sh.getRange(cf.rowNum,can).setValue(Number(s["Compras_Adiantadas"]||0));
          if(cc>0)cf.sh.getRange(cf.rowNum,cc).setValue(s["Classificacao"]||"Novo");
          atualiz++;
        }
      } else {
        const tels2=getTelsCLI();if(tel&&tels2.includes(tel))return;
        appendRowByHeaders("CLIENTES", {
          ID_Cliente: s["ID"] || newId("CLI"), Nome: s["Nome"] || "", WhatsApp: tel,
          Data_Cadastro: nowBR(),
          Score_Atual: Number(s["Score_Atual"] || 1000),
          Compras_No_Prazo: Number(s["Compras_No_Prazo"] || 0),
          Compras_Com_Atraso: Number(s["Compras_Com_Atraso"] || 0),
          Compras_Adiantadas: Number(s["Compras_Adiantadas"] || 0),
          Total_Gasto_RS: Number(s["Total_Gasto_RS"] || 0),
          Classificacao: s["Classificacao"] || "Novo", Origem_Contato: "Importacao_Contato"
        });
        novos++;
      }
    });
    log.push("CLIENTES_SCORE: "+atualiz+" scores, "+novos+" novos");
  }

  // Arquiva abas legadas renomeando (não deleta para não perder dados)
  function arquivarAba(nome) {
    const sh = getSheet(nome);
    if (!sh) return;
    const novoNome = "_OLD_" + nome;
    // Só renomeia se o nome _OLD_ não existir ainda
    if (!getSheet(novoNome)) {
      try { sh.setName(novoNome); log.push(nome + " \u2192 " + novoNome); } catch(e) { console.error("rename aba: " + e.message); }
    }
  }
  arquivarAba("Base_Clientes");
  arquivarAba("CLIENTES_SCORE");

  return { ok: true, log };
}

// \u2500\u2500 PDV SIMPLIFICADO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Registra pedido + baixa em chamada única, sem risco de inconsistência.
// Parâmetros via p (JSON stringify do frontend):
//   nomeCliente, telefone, itens (array), subtotal, abatimento,
//   totalFinal, formaPagamento, observacao, responsavel, dataVenda
function vendaPDV(p) {
  try {
    const dados = typeof p.dados === "string" ? JSON.parse(p.dados) : p;
    const shPed = getSheet("Pedidos");
    const shFin = getSheet("Financeiro_Fluxo");
    if (!shPed) return { error: "Aba Pedidos não encontrada. Execute setupSheets." };
    if (!shFin) return { error: "Aba Financeiro_Fluxo não encontrada. Execute setupSheets." };

    const idPedido   = newPedidoId();
    const dataHora   = dados.dataVenda ? String(dados.dataVenda) : nowBR();
    const nome       = String(dados.nomeCliente || "Consumidor Final");
    const telefone   = String(dados.telefone || "");
    const subtotal   = Number(dados.subtotal  || 0);
    const abatimento = Number(dados.abatimento || 0);
    const totalFinal = Math.max(0, Number(dados.totalFinal || (subtotal - abatimento)));
    const forma      = String(dados.formaPagamento || "PIX");
    const obs        = String(dados.observacao || "Venda PDV");
    const resp       = String(dados.responsavel || "");

    // Monta string de itens
    let itensArr = [];
    try { itensArr = Array.isArray(dados.itens) ? dados.itens : JSON.parse(dados.itens || "[]"); } catch(e) { console.error("vendaPDV itens JSON: " + e.message); }
    const itensStr = itensArr.map(function(i){ return i.nome + " (x" + i.qtd + ")"; }).join(" | ") || obs;

    // 1. Registra na aba Pedidos (mesma estrutura de novoPedido)
    appendRowByHeaders("Pedidos", {
      "ID Pedido": idPedido, "Data/Hora": dataHora, "Nome Cliente": nome, "Telefone": telefone,
      "Itens (JSON)": itensStr, "Subtotal (R$)": subtotal, "Cupom": "", "Desconto (R$)": abatimento,
      "tipoFrete": "", "valorFrete": 0, "Total (R$)": totalFinal, "Forma Pagamento": forma,
      "Status": "Finalizado", "Observações": obs, "Data_Vencimento": "",
      "ID_Evento_Agenda_Cobranca": "", "Fornecedor_Selecionado": "", "Custo_Lote": "",
      "Data_Finalizacao": dataHora, "ID_Evento_Agenda_Status": "", "Data_Criacao": dataHora,
      "Data_Confirmacao": dataHora, "Qtd_Parcelas": 1, "Intervalo_Dias": 0, "Responsavel": resp,
      "Endereco": "", "CEP": "", "Data_Acordada": "", "Data_Lembrete": ""
    });

    // 2. Registra baixa inline em Financeiro_Fluxo (ordem correta \u2014 sessão 2)
    appendRowByHeaders("Financeiro_Fluxo", {
      ID_Baixa: newId("BX"), ID_Pedido: idPedido, Nome_Cliente: nome,
      Valor_Original: subtotal, Status_Pagamento: "No Prazo", Dias_Atraso: 0,
      Taxa_Aplicada_RS: "0.00", Valor_Final_Recebido: totalFinal.toFixed(2),
      Data_Baixa_Efetiva: dataHora, Saldo_Restante: "0.00",
      Proxima_Vencimento: "", Telefone: telefone
    });

    // 3. Atualiza score do cliente (ignora erros)
    try { atualizarScore(nome, telefone, "No Prazo", 0); } catch(e) { console.error("vendaPDV atualizarScore: " + e.message); }

    return { ok: true, idPedido: idPedido, totalFinal: totalFinal };
  } catch(err) {
    return { error: "vendaPDV: " + err.message };
  }
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
// AUTOMAÇÕES \u2014 TRIGGERS DIÁRIOS / HORÁRIOS
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

// \u2500\u2500 TRIGGER: MORNING DIGEST (diário 7h) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _criarTriggerMorningDigest() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "enviarMorningDigest") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("enviarMorningDigest")
    .timeBased().everyDays(1).atHour(7).create();
}

// \u2500\u2500 TRIGGER: ALERTA SLA (a cada hora) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _criarTriggerSLA() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarSLA") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarSLA")
    .timeBased().everyHours(1).create();
}

// \u2500\u2500 TRIGGER: ALERTA VENCIMENTO D-1 (diário 9h) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function _criarTriggerVencimento() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "alertaVencimentoAmanha") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("alertaVencimentoAmanha")
    .timeBased().everyDays(1).atHour(9).create();
}

// ── TRIGGER: AVISO DE GARANTIA (diário 10h) — W5 ──
function _criarTriggerGarantia() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "verificarGarantia") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("verificarGarantia")
    .timeBased().everyDays(1).atHour(10).create();
}

// ── TRIGGER: BACKUP DIÁRIO DA PLANILHA (3h) — N19 ──
function _criarTriggerBackup() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "backupPlanilha") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("backupPlanilha")
    .timeBased().everyDays(1).atHour(3).create();
}
// N19: cópia diária da planilha inteira no Drive — protege contra edição/exclusão em massa
// que a lixeira (_Lixeira_*) não cobre (ex: fórmula quebrada sobrescrevendo linhas).
// Retenção de 30 dias, apaga backups mais velhos pra não crescer o Drive pra sempre.
function backupPlanilha() {
  try {
    const nomeBackup = "GJ Store - Backup " + Utilities.formatDate(new Date(), "America/Sao_Paulo", "yyyy-MM-dd_HH'h'mm");
    const folderName = "GJ Store - Backups Automaticos";
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const original = DriveApp.getFileById(SS.getId());
    const copia = original.makeCopy(nomeBackup, folder);
    copia.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);

    const limite = new Date(); limite.setDate(limite.getDate() - 30);
    let removidos = 0;
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.getId() !== copia.getId() && f.getDateCreated() < limite) {
        f.setTrashed(true);
        removidos++;
      }
    }
    return { ok: true, arquivo: nomeBackup, removidos: removidos };
  } catch (e) {
    console.error("backupPlanilha: " + e.message);
    return { ok: false, erro: e.message };
  }
}

// \u2500\u2500 SETUP COMPLETO DE TRIGGERS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function setupTodosOsTriggers() {
  _criarTriggerDashboard();
  _criarTriggerMorningDigest();
  _criarTriggerSLA();
  _criarTriggerVencimento();
  _criarTriggerGarantia();
  _criarTriggerBackup();
  return { ok: true, msg: "6 triggers criados: dashboard (1h), morning digest (7h), SLA (1h seg-sex 8-18h), vencimento D-1 (9h), garantia 7 dias (10h), backup diário (3h)" };
}

// E4.4: sem isso não tinha como o dono saber se os triggers estavam realmente ativos —
// só existia o botão "Ativar" (que sempre reporta sucesso), nunca uma forma de checar depois
function getTriggersStatus() {
  const esperados = ["atualizarDashboard", "enviarMorningDigest", "verificarSLA", "alertaVencimentoAmanha", "verificarGarantia", "backupPlanilha"];
  const ativos = ScriptApp.getProjectTriggers().map(function(t) { return t.getHandlerFunction(); });
  const status = esperados.map(function(fn) { return { funcao: fn, ativo: ativos.indexOf(fn) >= 0 }; });
  return { ok: true, triggers: status, total: status.filter(function(s) { return s.ativo; }).length, esperado: esperados.length };
}

// \u2500\u2500 VERIFICAR SLA \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Roda a cada hora (horário comercial seg-sex 8h-18h).
// Envia email se pedido Pendente ou Em Andamento
// passou do prazo configurado sem atualização.
function _isBusinessHours() {
  var agora = new Date();
  var dia = agora.getDay();
  var h = agora.getHours();
  return dia >= 1 && dia <= 5 && h >= 8 && h < 18;
}
function verificarSLA() {
  if (!_isBusinessHours()) return { enviado: false, motivo: "Fora do horário comercial (seg-sex 8h-18h) — não roda agora" };
  const emailDest = getConfigValue("EMAIL_NOTIFICACAO");
  if (!emailDest) return { enviado: false, motivo: "EMAIL_NOTIFICACAO não configurado na aba Config" };
  const nomeLoja = getConfigValue("NOME_LOJA") || "GJ Store";
  const slaPend  = Number(getConfigValue("SLA_PENDENTE_HORAS") || "24");
  const slaAnd   = Number(getConfigValue("SLA_ANDAMENTO_HORAS") || "48");
  const pedidos  = sheetToObjects("Pedidos") || [];
  const agora    = new Date();

  const vencidos = pedidos.filter(function(p) {
    const st = p["Status"] || "";
    if (st !== "Pendente" && st !== "Em andamento") return false;
    const dtStr = String(p["Data/Hora"] || "").trim();
    const parts = dtStr.split(/[\/ :]/);
    if (parts.length < 3) return false;
    // formato dd/mm/yyyy hh:mm:ss
    const dt = new Date(Number(parts[2].slice(0,4)), Number(parts[1])-1, Number(parts[0]),
      Number(parts[3]||0), Number(parts[4]||0));
    const horasPassadas = (agora - dt) / 3600000;
    const limite = st === "Pendente" ? slaPend : slaAnd;
    return horasPassadas > limite;
  });

  if (!vencidos.length) return { enviado: false, motivo: "Nenhum pedido passou do prazo de SLA agora" };

  const linhas = vencidos.slice(0, 10).map(function(p) {
    const horas = Math.floor((agora - (function(){
      const parts = String(p["Data/Hora"]||"").split(/[\/ :]/);
      return new Date(Number(parts[2].slice(0,4)), Number(parts[1])-1, Number(parts[0]), Number(parts[3]||0), Number(parts[4]||0));
    })()) / 3600000);
    return "<tr><td style='padding:6px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>#" + (p["ID Pedido"]||"?") + "</td>"
      + "<td style='padding:6px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>" + (p["Nome Cliente"]||"") + "</td>"
      + "<td style='padding:6px 10px;border-bottom:1px solid #1a2840;font-weight:700;color:#ff6d00'>" + p["Status"] + "</td>"
      + "<td style='padding:6px 10px;border-bottom:1px solid #1a2840;color:#f44336'>" + horas + "h</td></tr>";
  }).join("");

  const htmlBody = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
    + "<body style='background:#04090f;font-family:Arial;padding:24px'>"
    + "<div style='max-width:560px;margin:0 auto'>"
    + "<div style='background:#ff6d00;border-radius:14px 14px 0 0;padding:18px;text-align:center'>"
    + "<div style='font-size:24px;font-weight:900;color:#fff'>" + nomeLoja.toUpperCase() + "</div>"
    + "<div style='font-size:13px;font-weight:700;color:#fff;margin-top:4px'>\u26A0\uFE0F ALERTA DE SLA \u2014 " + vencidos.length + " pedido(s) atrasado(s)</div>"
    + "</div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;padding:16px'>"
    + "<table width='100%' cellpadding='0' cellspacing='0'>"
    + "<tr style='background:#08111f'><th style='padding:8px 10px;font-size:10px;color:#667;text-align:left'>PEDIDO</th>"
    + "<th style='padding:8px 10px;font-size:10px;color:#667;text-align:left'>CLIENTE</th>"
    + "<th style='padding:8px 10px;font-size:10px;color:#667;text-align:left'>STATUS</th>"
    + "<th style='padding:8px 10px;font-size:10px;color:#667;text-align:left'>TEMPO</th></tr>"
    + linhas
    + "</table></div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;border-top:none;border-radius:0 0 14px 14px;padding:12px;text-align:center'>"
    + "<div style='font-size:10px;color:#445'>" + nomeLoja + " · Alerta SLA automático</div></div></div></body></html>";

  GmailApp.sendEmail(emailDest, "\u26A0\uFE0F [SLA] " + vencidos.length + " pedido(s) atrasado(s) \u2014 " + nomeLoja, "", {
    htmlBody: htmlBody, name: nomeLoja
  });
  return { enviado: true, motivo: vencidos.length + " pedido(s) atrasado(s) — email enviado" };
}

// \u2500\u2500 ALERTA D-1 VENCIMENTO \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
// Roda às 8h. Envia email + monta links WhatsApp para cobranças
// que vencem AMANHÃ e ainda não estão quitadas.
function alertaVencimentoAmanha() {
  const emailDest = getConfigValue("EMAIL_NOTIFICACAO");
  if (!emailDest) return { enviado: false, motivo: "EMAIL_NOTIFICACAO não configurado na aba Config" };
  const nomeLoja = getConfigValue("NOME_LOJA") || "GJ Store";
  const pedidos  = sheetToObjects("Pedidos") || [];
  const baixas   = getSheet("Financeiro_Fluxo") ? sheetToObjects("Financeiro_Fluxo") : [];

  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  const amanhaStr = Utilities.formatDate(amanha, "America/Sao_Paulo", "dd/MM/yyyy");

  // Pedidos com vencimento amanhã, não finalizados/cancelados
  const vencem = pedidos.filter(function(p) {
    const dv = String(p["Data_Vencimento"] || "").split(" ")[0];
    const st = p["Status"] || "";
    if (st === "Finalizado" || st === "Cancelado") return false;
    return dv === amanhaStr;
  });

  // Filtra só os não quitados
  const cobrar = vencem.filter(function(p) {
    const id  = String(p["ID Pedido"] || "");
    const tot = Number(p["Total (R$)"] || 0);
    const pago = baixas.filter(function(b) {
      const st = String(b["Status_Pagamento"] || "");
      return String(b["ID_Pedido"]) === id && st !== "Pendente" && st !== "Liquidado";
    }).reduce(function(s, b) { return s + Number(b["Valor_Final_Recebido"] || 0); }, 0);
    return (tot - pago) > 0.01;
  });

  if (!cobrar.length) return { enviado: false, motivo: "Nenhuma cobrança em aberto vence amanhã (" + amanhaStr + ")" };

  const linhas = cobrar.slice(0, 15).map(function(p) {
    const id    = String(p["ID Pedido"] || "?");
    const nome  = p["Nome Cliente"] || "";
    const tel   = String(p["Telefone"] || "").replace(/\D/g, "");
    const saldo = Number(p["Total (R$)"] || 0);
    const saldoFmt = "R$ " + saldo.toFixed(2).replace(".", ",");
    const msg   = encodeURIComponent("Olá " + nome + "! \uD83D\uDC4B Lembrando que o pagamento de *" + saldoFmt + "* (pedido #" + id + ") vence *amanhã*. Podemos confirmar? \uD83D\uDE4F");
    const wpp   = tel ? "https://wa.me/55" + tel + "?text=" + msg : "";
    return "<tr><td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>#" + id + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>" + nome + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#00e676;font-weight:700'>" + saldoFmt + "</td>"
      + (wpp ? "<td style='padding:8px 10px;border-bottom:1px solid #1a2840'><a href='" + wpp + "' style='background:#25d366;color:#fff;padding:5px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700'>Cobrar WPP</a></td>"
             : "<td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#556'>Sem tel</td>") + "</tr>";
  }).join("");

  const totalGeral = cobrar.reduce(function(s, p) { return s + Number(p["Total (R$)"] || 0); }, 0);
  const totalFmt2  = "R$ " + totalGeral.toFixed(2).replace(".", ",");

  const htmlBody = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
    + "<body style='background:#04090f;font-family:Arial;padding:24px'>"
    + "<div style='max-width:580px;margin:0 auto'>"
    + "<div style='background:#00e676;border-radius:14px 14px 0 0;padding:18px;text-align:center'>"
    + "<div style='font-size:26px;font-weight:900;color:#04090f'>" + nomeLoja.toUpperCase() + "</div>"
    + "<div style='font-size:13px;font-weight:700;color:#04090f;margin-top:4px'>\uD83D\uDCB0 COBRANÇAS PARA AMANHÃ \u2014 " + amanhaStr + "</div>"
    + "</div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;padding:16px'>"
    + "<div style='font-size:11px;color:#667;margin-bottom:8px'>" + cobrar.length + " cobrança(s) · Total: <b style=\"color:#00e676\">" + totalFmt2 + "</b></div>"
    + "<table width='100%' cellpadding='0' cellspacing='0'>"
    + "<tr style='background:#08111f'>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>PEDIDO</th>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>CLIENTE</th>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>SALDO</th>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>AÇÃO</th></tr>"
    + linhas + "</table></div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;border-top:none;border-radius:0 0 14px 14px;padding:12px;text-align:center'>"
    + "<div style='font-size:10px;color:#445'>" + nomeLoja + " · Alerta D-1 vencimento</div></div></div></body></html>";

  GmailApp.sendEmail(emailDest, "\uD83D\uDCB0 [D-1] " + cobrar.length + " cobrança(s) vencem amanhã \u2014 " + nomeLoja, "", {
    htmlBody: htmlBody, name: nomeLoja
  });
  return { enviado: true, motivo: cobrar.length + " cobrança(s) vencem amanhã — email enviado" };
}

// W5: aviso de garantia — pedidos Finalizado/Entregue há exatamente 7 dias. GAS não manda
// WhatsApp direto (sem API paga), segue o mesmo padrão dos outros alertas: email pro dono com link
// wa.me pronto (Template 5 de mind/conceitos/02-mensagens-wpp.md), ele clica pra mandar.
// BUG-EMAIL-EMOJI: emoji literal corrompe no paste do editor Apps Script — sempre \u escape aqui.
function verificarGarantia() {
  const emailDest = getConfigValue("EMAIL_NOTIFICACAO");
  if (!emailDest) return { enviado: false, motivo: "EMAIL_NOTIFICACAO não configurado na aba Config" };
  const nomeLoja = getConfigValue("NOME_LOJA") || "GJ Store";
  const pedidos = sheetToObjects("Pedidos") || [];
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(hoje); alvo.setDate(alvo.getDate() - 7);
  const alvoStr = Utilities.formatDate(alvo, "America/Sao_Paulo", "dd/MM/yyyy");

  const entregues = pedidos.filter(function(p) {
    const st = p["Status"] || "";
    if (st !== "Finalizado" && st !== "Entregue") return false;
    const dtFin = String(p["Data_Finalizacao"] || "").split(" ")[0];
    const dtNorm = dtFin ? normalizarDataHora(dtFin).split(" ")[0] : "";
    return dtNorm === alvoStr;
  });
  if (!entregues.length) return { enviado: false, motivo: "Nenhum pedido completou 7 dias de entrega em " + alvoStr };

  const linhas = entregues.slice(0, 15).map(function(p) {
    const id = String(p["ID Pedido"] || "?");
    const nome = p["Nome Cliente"] || "";
    const tel = String(p["Telefone"] || "").replace(/\D/g, "");
    const msg = encodeURIComponent("Olá " + nome + "! Como está o produto do pedido #" + id + "? 🛒 Só lembrando que ele tem garantia. Se precisar de assistência, é só chamar!\n\nSe estiver tudo certo, ignore esta mensagem ✅");
    const wpp = tel ? "https://wa.me/55" + tel + "?text=" + msg : "";
    return "<tr><td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>#" + id + "</td>"
      + "<td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#e2f4ff'>" + nome + "</td>"
      + (wpp ? "<td style='padding:8px 10px;border-bottom:1px solid #1a2840'><a href='" + wpp + "' style='background:#25d366;color:#fff;padding:5px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:700'>Enviar WPP</a></td>"
             : "<td style='padding:8px 10px;border-bottom:1px solid #1a2840;color:#556'>Sem tel</td>") + "</tr>";
  }).join("");

  const htmlBody = "<!DOCTYPE html><html><head><meta charset='UTF-8'></head>"
    + "<body style='background:#04090f;font-family:Arial;padding:24px'>"
    + "<div style='max-width:580px;margin:0 auto'>"
    + "<div style='background:#00e676;border-radius:14px 14px 0 0;padding:18px;text-align:center'>"
    + "<div style='font-size:26px;font-weight:900;color:#04090f'>" + nomeLoja.toUpperCase() + "</div>"
    + "<div style='font-size:13px;font-weight:700;color:#04090f;margin-top:4px'>🔒 CHECK-IN DE GARANTIA — entregues em " + alvoStr + "</div>"
    + "</div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;padding:16px'>"
    + "<div style='font-size:11px;color:#667;margin-bottom:8px'>" + entregues.length + " pedido(s) completaram 7 dias</div>"
    + "<table width='100%' cellpadding='0' cellspacing='0'>"
    + "<tr style='background:#08111f'>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>PEDIDO</th>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>CLIENTE</th>"
    + "<th style='padding:7px 10px;font-size:10px;color:#667;text-align:left'>AÇÃO</th></tr>"
    + linhas + "</table></div>"
    + "<div style='background:#060c18;border:1px solid #1a2840;border-top:none;border-radius:0 0 14px 14px;padding:12px;text-align:center'>"
    + "<div style='font-size:10px;color:#445'>" + nomeLoja + " · Aviso de garantia (7 dias)</div></div></div></body></html>";

  GmailApp.sendEmail(emailDest, "🔒 Garantia — " + entregues.length + " pedido(s) pra checar — " + nomeLoja, "", {
    htmlBody: htmlBody, name: nomeLoja
  });
  return { enviado: true, motivo: entregues.length + " pedido(s) completaram 7 dias — email enviado" };
}

// ── IDENTIFICAÇÃO DE PRODUTOS POR IMAGEM (Gemini Vision) ──

function identificarProduto(p) {
  const url = p.cloudinaryUrl || p.url || '';
  if (!url) return { ok: false, erro: 'cloudinaryUrl obrigatório' };
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, erro: 'Falha ao baixar imagem: ' + res.getResponseCode() };
    const blob = res.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType() || 'image/jpeg';
    const result = geminiVisionRequest(base64, mimeType, IDENTIFY_PROMPT, 1024);
    if (result.error) return { ok: false, erro: result.error };
    const parsed = JSON.parse(extractJSONGemini(result.text));
    return {
      ok: true,
      marca: parsed.marca || '',
      modelo: parsed.modelo || '',
      cor: parsed.cor || '',
      estilo: parsed.estilo || '',
      nome_produto: parsed.nome_produto || '',
      descricao: parsed.descricao || '',
      usage: result.usage
    };
  } catch (e) {
    return { ok: false, erro: e.message };
  }
}

function extractJSONGemini(text) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : '{}';
}

function atualizarNomeProduto(p) {
  const id = p.id || '';
  if (!id) return { ok: false, erro: 'ID obrigatório' };
  const found = findRow("Produtos", 0, id);
  if (!found) return { ok: false, erro: 'Produto não encontrado: ' + id };
  const headers = getHeaders("Produtos");
  const updates = {};
  if (p.nome_produto) updates['Nome do Produto'] = p.nome_produto;
  if (p.descricao) updates['Descrição'] = p.descricao;
  for (const [campo, valor] of Object.entries(updates)) {
    const col = headers.indexOf(campo) + 1;
    if (col > 0) found.sh.getRange(found.rowNum, col).setValue(valor);
  }
  return { ok: true, id: id, atualizados: Object.keys(updates) };
}

// ── BATCH INSERT PRODUTOS (upload em lote) ──

function salvarProdutosBatch(p) {
  const itens = p.itens || [];
  if (!itens.length) return { ok: false, erro: 'itens obrigatório' };
  const sh = getSheet("Produtos");
  const headers = getHeaders("Produtos");
  const baseTs = Date.now();
  const rows = itens.map((item, idx) => {
    return headers.map(h => {
      if (h === "ID") return "P" + (baseTs + idx);
      if (item[h] !== undefined) return item[h];
      return "";
    });
  });
  const startRow = sh.getLastRow() + 1;
  sh.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
  const ids = rows.map(r => r[0]);
  _clearProdCache();
  return { ok: true, inseridos: ids.length, ids: ids };
}

function atualizarProdutosBatch(p) {
  const itens = p.itens || [];
  if (!itens.length) return { ok: false, erro: 'itens obrigatório' };
  const sh = getSheet("Produtos");
  const headers = getHeaders("Produtos");
  const idCol = headers.indexOf("ID") + 1;
  const allRows = sh.getDataRange().getValues();
  const idMap = {};
  for (let i = 1; i < allRows.length; i++) {
    const rowId = String(allRows[i][idCol - 1]);
    if (rowId) idMap[rowId] = i + 1;
  }
  let updated = 0;
  let notFound = 0;
  for (const item of itens) {
    const itemId = item.id || item["ID"] || "";
    const rowNum = idMap[itemId];
    if (!rowNum) { notFound++; continue; }
    for (const h of headers) {
      if (h === "ID") continue;
      if (item[h] !== undefined && item[h] !== "") {
        const col = headers.indexOf(h) + 1;
        sh.getRange(rowNum, col).setValue(item[h]);
      }
    }
    updated++;
  }
  _clearProdCache();
  return { ok: true, updated: updated, notFound: notFound };
}

function excluirProdutosBatch(p) {
  if (!_checkAdmin(p)) return { ok: false, erro: "Não autorizado" }; // X7: faltava — batch podia apagar em massa sem senha
  const ids = p.ids || [];
  if (!ids.length) return { ok: false, erro: 'ids obrigatório' };
  const sh = getSheet("Produtos");
  const headers = getHeaders("Produtos");
  const idCol = headers.indexOf("ID") + 1;
  const allRows = sh.getDataRange().getValues();
  const rowNums = [];
  for (let i = 1; i < allRows.length; i++) {
    if (ids.includes(String(allRows[i][idCol - 1]))) {
      rowNums.push(i + 1);
    }
  }
  rowNums.sort((a, b) => b - a);
  for (const rn of rowNums) {
    _backupLinha("_Lixeira_Produtos", headers, allRows[rn - 1]);
    sh.deleteRow(rn);
  }
  _clearProdCache();
  return { ok: true, deletados: rowNums.length, naoEncontrados: ids.length - rowNums.length };
}
