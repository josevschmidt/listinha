# Listinha - Rastreador de Preços Inteligente

Este é o WebApp **Listinha**, um rastreador de preços histórico com sincronização em tempo real e scanner de notas fiscais (NFC-e) alimentado por IA.

## Pré-requisitos

Antes de rodar o projeto, você precisa configurar as credenciais no arquivo `.env.local`.

1.  **Firebase**: Crie um projeto no console do Firebase e habilite o **Firestore** e **Google Auth**.
2.  **Gemini API**: Obtenha uma chave de API no Google AI Studio.

## Configuração

Copie os valores para o arquivo `d:\GitHub\listinha\.env.local`:

```
NEXT_PUBLIC_FIREBASE_API_KEY=sua-chave
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=seu-id
NEXT_PUBLIC_FIREBASE_APP_ID=seu-app-id

GEMINI_API_KEY=sua-chave-gemini
```

## Como Rodar

1.  Abra o terminal na pasta do projeto: `d:\GitHub\listinha`.
2.  Instale as dependências (caso não tenha feito):
    ```bash
    npm install
    ```
3.  Inicie o servidor de desenvolvimento:
    ```bash
    npm run dev
    ```
4.  Acesse [http://localhost:3000](http://localhost:3000) no seu navegador.

## Funcionalidades
- [x] Login com Google.
- [x] Listas compartilhadas em tempo real.
- [x] Scanner de QR Code de notas fiscais.
- [x] Fuzzy Matching de produtos via IA (Gemini).
- [x] Histórico de preços por item.
- [x] PWA (Instalável no celular).

## Estrutura do Projeto
- `/src/app`: Rotas e páginas do Next.js.
- `/src/components`: Componentes UI (Shadcn UI).
- `/src/lib`: Configurações de Firebase e serviços.
- `/src/contexts`: Contexto de Autenticação.
- `/public`: Manifesto PWA, ícones e assets.
