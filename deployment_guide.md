# Deployment Guide: Render.com

Deploying a Next.js app to Render requires setting up a **Web Service**. Unlike Vercel, Render serves the app as a standard Node.js process.

## 1. Initial Deployment (Render)

1. **Dashboard**: Go to [dashboard.render.com](https://dashboard.render.com) and click **"New" > "Web Service"**.
2. **Connect Repository**: Link your GitHub/Git repository.
3. **Settings**:
    - **Language**: `Node`
    - **Build Command**: `npm install; npm run build`
    - **Start Command**: `node .next/standalone/server.js` (We've optimized the build for this).
4. **Environment Variables**: Click the **Advanced** button or go to the **Env Vars** tab. Copy all variables from your [.env.local](file:///d:/GitHub/listinha/.env.local) (Firebase keys, etc.).
5. **Deploy**: Click **Create Web Service**.

## 2. Configuring your Subdomain

To use `listinha.josevschmidt.com.br`:

1. **Render Settings**: In your service dashboard, go to the **Settings** tab and scroll down to **Custom Domains**.
2. **Add Domain**: Add `listinha.josevschmidt.com.br`.
3. **DNS Configuration**: Render will give you instructions. Usually:
    - **Type**: `CNAME`
    - **Name/Host**: `listinha`
    - **Value/Target**: `your-service-name.onrender.com`

## 3. Firebase Security (CRITICAL)

Since you are using Firebase Authentication, you MUST authorize the new domain:

1. **Firebase Console**: [console.firebase.google.com](https://console.firebase.google.com).
2. **Authentication**: Go to **Settings > Authorized Domains**.
3. **Add Domain**: Add `listinha.josevschmidt.com.br`. 

> [!IMPORTANT]
> If you don't do this, Google Login will fail with a "domain not authorized" error.

## 4. Performance Tip
I've added `output: "standalone"` to your [next.config.ts](file:///d:/GitHub/listinha/next.config.ts). This makes the build significantly smaller and faster to boot up on Render.

## 5. CI/CD with GitHub Actions

While Render has native auto-deploy, using GitHub Actions allows you to run tests and linting **before** a deployment is triggered.

### 1. Get the Deploy Hook
1. Go to your **Render Dashboard**.
2. Go to **Settings > Deploy Hook**.
3. Copy the URL. It looks like `https://api.render.com/deploy/srv-...`.

### 2. Add Secret to GitHub
1. In your GitHub repository, go to **Settings > Secrets and variables > Actions**.
2. Click **New repository secret**.
3. Name: `RENDER_DEPLOY_HOOK`
4. Value: Paste the URL from Render.

### 3. Create the Workflow
I have created a sample workflow for you at `.github/workflows/deploy.yml`. 
Every time you push to `main`, GitHub will:
1. Run `lint` and `build` to check for errors.
2. If successful, it will ping Render to start the deployment.

> [!TIP]
> Once this is set up, you should disable **"Auto-Deploy"** in the Render Settings to ensure deployments only happen if your GitHub Action passes.
