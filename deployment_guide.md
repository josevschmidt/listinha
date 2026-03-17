# Deployment Guide: Vercel

Este guia explica como fazer o deploy do **Listinha** no Vercel com domínio customizado.

## 1. Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub.
2. Clique em **"Add New..." > "Project"**.
3. Selecione o repositório **listinha** e clique em **"Import"**.
4. O Vercel detecta automaticamente que é um projeto Next.js. Não altere as configurações de build.
5. Antes de clicar em **"Deploy"**, adicione as **variáveis de ambiente** (próximo passo).

## 2. Variáveis de Ambiente

Na tela de import (ou em **Settings > Environment Variables** depois), adicione:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Sua API key do Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `seu-projeto.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID do seu projeto Firebase |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `seu-projeto.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID do Firebase |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID do Firebase |
| `GEMINI_API_KEY` | Sua chave da API Gemini |

> [!IMPORTANT]
> As variáveis `NEXT_PUBLIC_*` são embutidas no JavaScript durante o build. Elas **devem existir antes do deploy**, caso contrário o Firebase não funciona.

## 3. Domínio Customizado

Para usar `listinha.josevschmidt.com.br`:

1. No Vercel, vá em **Settings > Domains**.
2. Adicione `listinha.josevschmidt.com.br`.
3. Configure o DNS no seu provedor de domínio:
    - **Tipo**: `CNAME`
    - **Nome/Host**: `listinha`
    - **Valor/Target**: `cname.vercel-dns.com`
4. O Vercel provisiona o certificado SSL automaticamente.

> [!TIP]
> Se você já tinha um CNAME apontando para o Render (`*.onrender.com`), **atualize-o** para `cname.vercel-dns.com`.

## 4. Firebase Authentication (OBRIGATÓRIO)

Você **deve** autorizar o domínio no Firebase para que o login Google funcione:

1. Acesse o [Firebase Console](https://console.firebase.google.com).
2. Vá em **Authentication > Settings > Authorized Domains**.
3. Adicione `listinha.josevschmidt.com.br`.
4. Adicione também o domínio gerado pelo Vercel (ex: `listinha-xxxx.vercel.app`).

> [!IMPORTANT]
> Sem isso, o Google Login vai falhar com erro "domain not authorized".

## 5. CI/CD

O Vercel faz build e deploy automaticamente a cada push na branch `main`. Não é necessário webhook ou GitHub Actions para deploy.

Um workflow de CI (`.github/workflows/ci.yml`) está configurado para rodar lint em pull requests, garantindo qualidade antes do merge.

## 6. Limpeza do Render (opcional)

Se você estava usando o Render anteriormente:

1. Acesse [dashboard.render.com](https://dashboard.render.com).
2. Delete o Web Service do Listinha.
3. Remova o secret `RENDER_DEPLOY_HOOK` do GitHub (Settings > Secrets).
