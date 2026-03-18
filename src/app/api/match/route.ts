import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

export async function POST(request: Request) {
  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables.");
    }

    const { userList, sefazList } = await request.json();

    if (!userList || !sefazList) {
      return NextResponse.json(
        { error: "Both userList and sefazList are required" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Use the Flash model configured to return JSON
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { 
        responseMimeType: "application/json" 
      }
    });

    const prompt = `
    Você é um assistente de compras inteligente. 
    Sua tarefa é cruzar os itens de uma lista de compras genérica feita pelo usuário com os itens reais extraídos do comprovante de uma nota fiscal (SEFAZ).
    
    Lista do usuário (itens pendentes): ${JSON.stringify(userList)}
    Itens da Nota Fiscal: ${JSON.stringify(sefazList)}

    Regras:
    1. Tente realizar o "fuzzy matching". Por exemplo, se o usuário anotou "Leite" e na nota veio "LEITE INT BATAVO 1L", isso é um match.
    2. Considere erros de digitação e abreviações da nota fiscal.
    3. Retorne APENAS um objeto JSON válido seguindo ESTRITAMENTE a seguinte estrutura:
       {
         "matched": [
           {
             "user_item_id": "ID do item do userList que deu match",
             "user_item_name": "Nome original do item do usuário",
             "sefaz_name": "Nome do produto conforme veio na nota fiscal",
             "price": 10.50
           }
         ],
         "unmatched_sefaz": [
           {
             "sefaz_name": "Nome do item da nota que sobrou (não bateu com nada da lista)",
             "price": 5.00
           }
         ],
         "unmatched_user": [
           {
             "user_item_id": "ID do item da lista do usuário que não foi achado na nota",
             "user_item_name": "Nome do item que sobrou da lista"
           }
         ]
       }
    `;

    const result = await model.generateContent(prompt);
    const textResponse = result.response.text();
    
    // Safety parse just in case
    const jsonMatchData = JSON.parse(textResponse);

    return NextResponse.json(jsonMatchData);
    
  } catch (error) {
    console.error("Gemini Match Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
