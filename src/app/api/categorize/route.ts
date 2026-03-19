import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const CATEGORIES = [
  "Hortifruti", "Carnes", "Laticínios", "Padaria", "Bebidas",
  "Limpeza", "Higiene", "Mercearia", "Congelados", "Outros",
];

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    if (!apiKey) throw new Error("GEMINI_API_KEY is not defined");

    const { itemName } = await request.json();
    if (!itemName) {
      return NextResponse.json({ error: "itemName is required" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = `Classifique o item de lista de compras abaixo em UMA das categorias disponíveis.
Categorias: ${CATEGORIES.join(", ")}
Item: "${itemName}"
Responda APENAS com JSON no formato: { "category": "NomeDaCategoria" }`;

    const result = await model.generateContent(prompt);
    const data = JSON.parse(result.response.text());

    if (!CATEGORIES.includes(data.category)) data.category = "Outros";

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
