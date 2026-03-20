import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Nenhuma imagem enviada." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/jpeg";

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const prompt = `
    Você é um assistente especializado em ler notas fiscais brasileiras (NFC-e / cupom fiscal).
    Analise a imagem da nota fiscal e extraia TODOS os itens de produto com seus respectivos preços totais (valor total do item, não unitário).

    Também extraia:
    - O nome do estabelecimento (store_name)
    - A data de emissão no formato DD/MM/YYYY (emission_date), se visível

    Retorne APENAS um JSON válido neste formato:
    {
      "items": [
        { "name": "NOME DO PRODUTO", "price": 10.50, "original_text": "texto original da linha" }
      ],
      "store_name": "Nome do Estabelecimento",
      "emission_date": "DD/MM/YYYY"
    }

    Regras:
    1. O preço deve ser o VALOR TOTAL de cada item (quantidade × preço unitário), não o preço unitário
    2. Ignore linhas de subtotal, total, desconto, troco, forma de pagamento
    3. Se não conseguir ler algum campo, use null para emission_date ou "Desconhecido" para store_name
    4. Os preços devem ser números decimais (ex: 10.50, não "10,50")
    5. Extraia o máximo de itens possível, mesmo que a imagem esteja parcialmente ilegível
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64,
        },
      },
    ]);

    const textResponse = result.response.text();
    const parsed = JSON.parse(textResponse);

    if (!parsed.items || parsed.items.length === 0) {
      return NextResponse.json(
        { error: "Não foi possível identificar itens na imagem. Tente uma foto mais nítida." },
        { status: 422 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("OCR Error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
