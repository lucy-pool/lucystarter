# Setup Guide

Get the Convex + Clerk starter running locally.

## Prerequisites

- [Bun](https://bun.sh/) (or Node.js 18+)
- A [Clerk](https://clerk.com/) account
- A [Convex](https://convex.dev/) account

## 1. Install dependencies

```bash
bun install
```

## 2. Set up Clerk

1. Go to [dashboard.clerk.com](https://dashboard.clerk.com) and create a new application
2. In your Clerk dashboard, go to **JWT Templates** and create a new template:
   - Name: `convex`
   - Issuer: leave as default (this is your `CLERK_JWT_ISSUER_DOMAIN`)
3. Copy your keys from **API Keys** in the Clerk dashboard

## 3. Create environment file

```bash
cp .env.example .env.local
```

Fill in the Clerk values:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

The `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` values are auto-filled when you run `bunx convex dev` for the first time.

## 4. Start Convex

```bash
bunx convex dev
```

On first run, this will:
- Prompt you to log in to Convex
- Create a new project (or link an existing one)
- Push the schema and functions
- Auto-fill `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local`

## 5. Set the Clerk JWT issuer domain in Convex

```bash
bunx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-domain.clerk.accounts.dev
```

Replace `your-domain` with the issuer domain from your Clerk dashboard (found under **JWT Templates** > `convex`).

## 6. Start Next.js

In a second terminal:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the landing page. Sign up to access the dashboard.

## Optional: Cloudflare R2 (file uploads)

File uploads use the `@convex-dev/r2` component with Cloudflare R2 storage. Files go directly from the browser to R2 via presigned URLs — Convex only stores metadata.

### 1. Create an R2 bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Overview**
2. Click **Create Bucket**
3. Name it (e.g. `convex-clerk-starter-main`) and create

### 2. Create an R2 API token

1. In **R2** → **Overview**, click **Manage R2 API Tokens**
2. Click **Create API Token** under "Account API Tokens"
3. Give it a name (e.g. `convex-r2`)
4. Set permissions to **Object Read & Write**
5. Scope it to your bucket
6. Click **Create API Token**
7. Copy the **Access Key ID** and **Secret Access Key** (the secret is only shown once)

Your **endpoint** follows this pattern — find your Account ID on the R2 Overview sidebar:
```
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

### 3. Set env vars in Convex

```bash
bunx convex env set R2_ENDPOINT https://<ACCOUNT_ID>.r2.cloudflarestorage.com
bunx convex env set R2_ACCESS_KEY_ID <your-access-key-id>
bunx convex env set R2_SECRET_ACCESS_KEY <your-secret-access-key>
bunx convex env set R2_BUCKET <your-bucket-name>
```

### 4. Configure CORS on the R2 bucket

In Cloudflare Dashboard → **R2** → your bucket → **Settings** → **CORS Policy**, add:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://your-domain.com",
      "https://*.your-domain.com"
    ],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace `your-domain.com` with your production domain. The `*` wildcard covers all subdomains (e.g. `app.your-domain.com`, `www.your-domain.com`).

## Optional: OpenRouter (AI chat)

```bash
bunx convex env set OPENROUTER_API_KEY sk-or-v1-...
bunx convex env set DEFAULT_OPENROUTER_MODEL google/gemini-3-flash-preview
```

Browse available models at [openrouter.ai/models](https://openrouter.ai/models). If no model is set, it defaults to `mistralai/devstral-2512:free`.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `CLERK_JWT_ISSUER_DOMAIN` error | Make sure you set it as a Convex env var (step 5), not in `.env.local` |
| Auth not working | Verify the Clerk JWT template is named exactly `convex` |
| File uploads failing | Check all 4 R2 env vars are set in Convex dashboard and CORS is configured on the bucket |
| AI chat error | Verify `OPENROUTER_API_KEY` is set in Convex dashboard |
| `bunx convex dev` won't start | Run `bun install` first, ensure you're logged in to Convex |
