import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

type ParsedItem = { name: string; price: number; original_text: string };

function parsePrice(text: string): number | null {
  // Handles "1.234,56" and "1234.56" and "12,56"
  const cleaned = text.replace(/[^\d,\.]/g, "");
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const val = parseFloat(normalized);
  return isNaN(val) || val <= 0 ? null : val;
}

function tryParseTabResult($: cheerio.CheerioAPI): ParsedItem[] {
  // Most common: <table id="tabResult"> — used in SP, PR, SC, GO, RS and others
  const items: ParsedItem[] = [];
  $("#tabResult tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;

    let name: string;
    let price: number | null;

    if (cells.length >= 3) {
      // Multi-column layout: [seq, description, qty, unit, unit_price, total]
      name = $(cells[1]).text().trim();
      // Prefer unit price (second-to-last column) over total (last column)
      if (cells.length >= 4) {
        price = parsePrice($(cells[cells.length - 2]).text().trim());
        if (!price) price = parsePrice($(cells[cells.length - 1]).text().trim());
      } else {
        price = parsePrice($(cells[cells.length - 1]).text().trim());
      }
    } else {
      // 2-column layout (RS/SVRS): name in .txtTit span, price in .valor span
      name = $(cells.first()).find(".txtTit").first().text().trim();
      const valorSpan = $(row).find(".valor");
      price = valorSpan.length
        ? parsePrice(valorSpan.first().text().trim())
        : parsePrice($(cells.last()).text().trim());
    }

    if (!name || name.length < 2) return;
    if (!price) return;
    items.push({ name, price, original_text: $(row).text().trim() });
  });
  return items;
}

function tryParseTxtTit($: cheerio.CheerioAPI): ParsedItem[] {
  // RS / RJ pattern: items described by .txtTit spans inside rows
  const items: ParsedItem[] = [];
  // Each product is typically a <tr> that contains a .txtTit with the name
  // and another .txtTit with the price
  $("tr").each((_, row) => {
    const tits = $(row).find(".txtTit, .tx");
    if (tits.length < 2) return;
    const name = $(tits[0]).text().trim();
    // Last .txtTit in the row is usually the total price
    const priceText = $(tits[tits.length - 1]).text().trim();
    if (!name || name.length < 2) return;
    const price = parsePrice(priceText);
    if (!price) return;
    items.push({ name, price, original_text: $(row).text().trim() });
  });
  return items;
}

function tryParseInfCpl($: cheerio.CheerioAPI): ParsedItem[] {
  // MG / RN / some others: products in divs with class containing "infCpl" or "Prod"
  const items: ParsedItem[] = [];
  $(".infCpl, .Prod, .prod_campo").each((_, el) => {
    const text = $(el).text().trim();
    // Try to extract "PRODUCT NAME ... R$ XX,XX" from text
    const priceMatch = text.match(/R?\$?\s*([\d.,]+)\s*$/);
    if (!priceMatch) return;
    const price = parsePrice(priceMatch[1]);
    if (!price) return;
    const name = text.replace(priceMatch[0], "").trim().split(/\s{2,}/)[0];
    if (!name || name.length < 2) return;
    items.push({ name, price, original_text: text });
  });
  return items;
}

function parseEmissionDate($: cheerio.CheerioAPI): string | null {
  // Look for emission date in the HTML — common patterns across SEFAZ portals
  const body = $("body").text();

  // Pattern: "Emissão: DD/MM/YYYY HH:MM:SS" or "Data de Emissão: DD/MM/YYYY"
  const match = body.match(/Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (match) return match[1]; // Returns "DD/MM/YYYY"

  // Pattern: "Data Emissão DD/MM/YYYY"
  const match2 = body.match(/Data\s+Emiss[ãa]o\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (match2) return match2[1];

  return null;
}

function parseEmissionDateFromAccessKey(url: string): string | null {
  // NFC-e access key is 44 digits. Positions 3-6 contain YYMM (year+month).
  // This is a fallback — only gives year+month, no day.
  const keyMatch = url.match(/[?&]p=(\d{44})/);
  if (!keyMatch) return null;

  const key = keyMatch[1];
  const yy = key.substring(2, 4);
  const mm = key.substring(4, 6);
  const year = 2000 + parseInt(yy, 10);
  const month = parseInt(mm, 10);

  if (month < 1 || month > 12) return null;
  // Return first day of month as fallback
  return `01/${mm}/${year}`;
}

function tryParseGenericTable($: cheerio.CheerioAPI): ParsedItem[] {
  // Generic fallback: scan all tables looking for rows with a name + price pattern
  const items: ParsedItem[] = [];
  const seen = new Set<string>();

  $("table tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 2) return;
    const allText = $(row).text();
    // Row must contain a price-like pattern
    if (!/[\d]+[,.][\d]{2}/.test(allText)) return;

    // First non-empty text cell is likely the product name
    let name = "";
    let price: number | null = null;
    cells.each((i, cell) => {
      const t = $(cell).text().trim();
      if (!name && t.length > 2 && /[A-Za-zÀ-ú]/.test(t)) {
        name = t;
      }
      // Last numeric cell with decimals = price
      const p = parsePrice(t);
      if (p && p < 10000) price = p; // cap to avoid parsing qty as price
    });

    if (!name || !price || seen.has(name)) return;
    seen.add(name);
    items.push({ name, price, original_text: $(row).text().trim() });
  });
  return items;
}

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL é obrigatória." }, { status: 400 });
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Não foi possível acessar a nota fiscal (HTTP ${response.status}). Verifique se o QR Code é de uma NFC-e válida.` },
        { status: 422 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try each parser in order of specificity
    let items: ParsedItem[] = tryParseTabResult($);

    if (items.length === 0) items = tryParseTxtTit($);
    if (items.length === 0) items = tryParseInfCpl($);
    if (items.length === 0) items = tryParseGenericTable($);

    if (items.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível extrair itens desta nota fiscal. O formato do estado emissor pode não ser suportado ainda." },
        { status: 422 }
      );
    }

    // Extract store name from common locations
    const storeName =
      $(".txtTopo, #x-nomeEmit, .nomeEmpresa, h4").first().text().trim() ||
      "Desconhecido";

    // Extract emission date from HTML, fallback to access key
    const emissionDate = parseEmissionDate($) || parseEmissionDateFromAccessKey(url);

    return NextResponse.json({ items, store_name: storeName, emission_date: emissionDate });

  } catch (error) {
    console.error("SEFAZ Extractor Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
