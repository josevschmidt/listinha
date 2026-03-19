# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server (Next.js with Webpack)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint (runs on PRs via GitHub Actions CI)
```

No test framework is configured. CI runs lint only (Node 20, Ubuntu 24.04).

## Environment Variables

Firebase config uses `NEXT_PUBLIC_FIREBASE_*` env vars (API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID). The AI matching route requires `GEMINI_API_KEY` (server-side only).

## Architecture

**Listinha** is a collaborative shopping list app with AI-powered receipt scanning, built with Next.js 16 (App Router), React 19, Firebase, and Tailwind CSS 4. All UI text is in Brazilian Portuguese (pt-BR), currency in BRL (R$).

### Key Layers

- **Auth**: Firebase Google OAuth managed via React Context (`src/contexts/AuthContext.tsx`). The `useAuth()` hook provides user state. Pages protect themselves with `useEffect` redirects.
- **Data**: Firestore is the single source of truth. Real-time sync via `onSnapshot` listeners. All Firestore operations live in `src/lib/services/listService.ts`.
- **API Routes** (server-side, under `src/app/api/`):
  - `POST /api/sefaz` — Fetches and parses Brazilian NFC-e receipt HTML (multiple regional SEFAZ parsers using Cheerio)
  - `POST /api/match` — Fuzzy-matches user list items against receipt items using Gemini 1.5 Flash (JSON response mode)
- **UI**: Shadcn UI components in `src/components/ui/`, styled with Tailwind CSS 4 and glassmorphism effects (`glass`, `premium-shadow` classes in `globals.css`). Uses `@/*` path alias mapped to `./src/*`.

### Data Model (Firestore)

- **`lists/{id}`** — `name`, `share_code` (LST-XXXXXX), `owner_id`, `member_ids[]`, `created_at`
  - **`items/{id}`** — `name`, `status` (pending|bought), `averagePrice`, `priceHistory[]`
  - **`shared_with/{userId}`** — join tracking
- **`price_history/{id}`** — standalone collection

Lists use `member_ids` array for access control (Firestore rules check membership). Share codes enable joining via `joinListByCode()`.

### Receipt Scanning Flow

QR code scan → extract NFC-e URL → `POST /api/sefaz` (parse HTML) → `POST /api/match` (AI matching) → user validates matches in ValidationModal → save prices to items.

### PWA

Configured via `next-pwa` in `next.config.ts`. Disabled in development, enabled in production with auto-registration and skip-waiting.

### Firestore Rules

Defined in `firestore.rules` at project root. Auto-deployed to Firebase on push to main via GitHub Actions (`deploy-firebase-rules.yml`).
