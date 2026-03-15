import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // 1. Fetch the HTML from the SEFAZ URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const items: Array<{ name: string; price: number; original_text: string }> = [];

    // --- WARNING ---
    // The structure of the NFC-e HTML varies WILDLY between Brazilian states (SP, RS, RJ, MG, etc.).
    // This below is a VERY generic mock/example attempt. 
    // In a real production app, you would need specific parsers for each state's domain.
    
    // Example: trying to find rows in a generic SEFAZ RS / PR table format
    // Usually items are in a table with a specific class or ID, like #tabResult
    const rows = $('#tabResult tr, .tx, .txtTit').toArray(); // Generic selectors

    // ... Implementation would go here to iterate over 'rows' and extract text
    
    // --- MOCK FALLBACK for MVP/Testing ---
    // If we can't parse it (because we don't know the exact state yet), returning mock data 
    // just to prove the Gemini AI flow works.
    if (items.length === 0) {
       console.log("Using Mock SEFAZ Data (State parser not implemented)");
       return NextResponse.json({
         items: [
           { name: "LEITE INT BATAVO 1L", price: 4.99, original_text: "001 LEITE INT BATAVO 1L UN 4,99" },
           { name: "PAO DE FORMA WICKBOLD", price: 7.50, original_text: "002 PAO DE FORMA WICKBOLD 500G UN 7,50" },
           { name: "CARNE MOIDA ACEM KG", price: 25.00, original_text: "003 CARNE MOIDA ACEM KG 1,000 25,00" },
           { name: "SABAO EM PO OMO 1KG", price: 12.90, original_text: "004 SABAO EM PO OMO 1KG UN 12,90" },
           { name: "CERVEJA HEINEKEN LATA 350ML", price: 5.50, original_text: "005 CERVEJA HEINEKEN LATA 350ML UN 5,50" }
         ],
         store_name: "SUPERMERCADO MOCK LTDA",
         raw_html_length: html.length // Just for debugging
       });
    }

    return NextResponse.json({ items, store_name: "Unknown Store" });

  } catch (error: any) {
    console.error("SEFAZ Extractor Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
