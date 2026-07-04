// Parsers de extrato (OFX 1.x/2.x e CSV) + casamento de regras de categoria.
// Zero dependência: OFX 1.x é SGML (fecha tags de leaf implicitamente), então
// extraímos por regex simples de <STMTTRN>...</STMTTRN>.

// Converte "YYYYMMDD" (ou "YYYYMMDDHHMMSS[...]") do OFX para "YYYY-MM-DD".
function ofxDateToISO(raw) {
  if (!raw) return "";
  const m = String(raw).trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function tag(block, name) {
  // Captura o valor de <NAME>valor até a próxima tag ou fim de linha (SGML).
  const re = new RegExp(`<${name}>([^<\\r\\n]*)`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : "";
}

// Parseia OFX (banco ou cartão). Retorna transações normalizadas.
export function parseOFX(text) {
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || [];
  const out = [];

  for (const block of blocks) {
    const amountRaw = tag(block, "TRNAMT").replace(",", ".");
    const amount = parseFloat(amountRaw);
    if (Number.isNaN(amount)) continue;

    const date = ofxDateToISO(tag(block, "DTPOSTED"));
    const fitid = tag(block, "FITID");
    const name = tag(block, "NAME");
    const memo = tag(block, "MEMO");
    const desc = [name, memo].filter(Boolean).join(" ").trim() || "Sem descrição";

    out.push({
      date,
      amount, // negativo = despesa, positivo = receita
      fitid,
      desc,
      type: amount < 0 ? "despesa" : "receita",
    });
  }

  return out;
}

// Parseia CSV genérico. Tenta achar colunas de data, valor e descrição.
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];

  const delim = (lines[0].match(/;/g) || []).length >
    (lines[0].match(/,/g) || []).length
    ? ";"
    : ",";

  const split = (line) => line.split(delim).map((s) => s.trim().replace(/^"|"$/g, ""));
  const header = split(lines[0]).map((h) => h.toLowerCase());

  const findCol = (...keys) =>
    header.findIndex((h) => keys.some((k) => h.includes(k)));

  const dateCol = findCol("data", "date");
  const valueCol = findCol("valor", "value", "amount", "montante");
  const descCol = findCol("descr", "histor", "memo", "lançamento", "lancamento", "estabelec");

  const hasHeader = dateCol >= 0 || valueCol >= 0;
  const rows = hasHeader ? lines.slice(1) : lines;
  const out = [];

  for (let i = 0; i < rows.length; i++) {
    const cols = split(rows[i]);
    const rawDate = cols[dateCol >= 0 ? dateCol : 0] || "";
    const rawVal = cols[valueCol >= 0 ? valueCol : 1] || "";
    const desc = (cols[descCol >= 0 ? descCol : 2] || "Sem descrição").trim();

    // Normaliza valor: remove milhar, aceita vírgula decimal.
    let v = rawVal.replace(/[^\d,.-]/g, "");
    if (v.includes(",") && v.includes(".")) v = v.replace(/\./g, "").replace(",", ".");
    else if (v.includes(",")) v = v.replace(",", ".");
    const amount = parseFloat(v);
    if (Number.isNaN(amount)) continue;

    // Normaliza data DD/MM/YYYY -> YYYY-MM-DD, ou mantém ISO.
    let date = rawDate;
    const br = rawDate.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
    if (br) date = `${br[3]}-${br[2]}-${br[1]}`;

    out.push({
      date,
      amount,
      fitid: "", // CSV normalmente não traz FITID; dedup vira por data+valor+desc
      desc: desc || "Sem descrição",
      type: amount < 0 ? "despesa" : "receita",
    });
  }

  return out;
}

// Escolhe o parser certo pelo conteúdo/nome do arquivo.
export function parseStatement(text, filename = "") {
  const looksOFX = /OFXHEADER|<OFX>|<STMTTRN>/i.test(text) || /\.ofx$/i.test(filename);
  return looksOFX ? parseOFX(text) : parseCSV(text);
}

// Sugere um padrão de regra a partir da descrição: pega o trecho antes de "*",
// dígitos e separadores; fica com a primeira palavra significativa.
export function suggestPattern(desc) {
  if (!desc) return "";
  const head = desc.split("*")[0];
  const cleaned = head.replace(/[0-9]+/g, " ").replace(/[^\p{L}\s]/gu, " ").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  return (words[0] || cleaned || desc).toLowerCase().trim();
}

// Acha a categoria de uma descrição pelas regras "contém" (mais longa vence).
export function matchRule(desc, rules) {
  const d = (desc || "").toLowerCase();
  let best = null;
  for (const r of rules) {
    const p = (r.pattern || "").toLowerCase();
    if (p && d.includes(p)) {
      if (!best || p.length > best.pattern.length) best = r;
    }
  }
  return best;
}
