# Setup Guide

Get the Next.js + Convex Auth starter running locally.

## Prerequisites

- [Bun](https://bun.sh/) (or Node.js 18+)
- A [Convex](https://convex.dev/) account

## 1. Install dependencies

```bash
bun install
```

## 2. Start Convex

```bash
bunx convex dev
```

On first run, this will:
- Prompt you to log in to Convex
- Create a new project (or link an existing one)
- Push the schema and functions
- Auto-fill `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` in `.env.local`

## 3. Initialize Convex Auth

This step generates the `JWT_PRIVATE_KEY` and `JWKS` environment variables that Convex Auth needs to sign and verify tokens. **You must run this once on first setup** — without it, sign-up and sign-in will fail with `Missing environment variable` errors.

```bash
npx @convex-dev/auth
```

This will automatically:
- Set `SITE_URL` in your Convex deployment
- Generate and set `JWT_PRIVATE_KEY` (RSA private key for signing JWTs)
- Generate and set `JWKS` (public key for verifying JWTs)
- Verify your auth config files are correct

## 4. Start Next.js

In a second terminal:

```bash
bun dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see the landing page. Sign up with email/password to access the dashboard.

## Optional: GitHub OAuth

1. Create a GitHub OAuth App at [github.com/settings/developers](https://github.com/settings/developers)
   - Homepage URL: `http://localhost:3000`
   - Callback URL: your Convex site URL + `/api/auth/callback/github` (find your site URL with `bunx convex env get SITE_URL`)
2. Set the env vars in Convex:

```bash
bunx convex env set AUTH_GITHUB_ID your-github-client-id
bunx convex env set AUTH_GITHUB_SECRET your-github-client-secret
```

## Optional: Google OAuth

1. Create credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Authorized redirect URI: your Convex site URL + `/api/auth/callback/google`
2. Set the env vars in Convex:

```bash
bunx convex env set AUTH_GOOGLE_ID your-google-client-id
bunx convex env set AUTH_GOOGLE_SECRET your-google-client-secret
```

## Optional: Cloudflare R2 (file uploads)

File uploads use the `@convex-dev/r2` component with Cloudflare R2 storage. Files go directly from the browser to R2 via presigned URLs — Convex only stores metadata.

### 1. Create an R2 bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2** → **Overview**
2. Click **Create Bucket**
3. Name it (e.g. `convex-starter-uploads`) and create

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
| `Missing environment variable JWT_PRIVATE_KEY` | Run `npx @convex-dev/auth` (step 3) |
| `Missing environment variable JWKS` | Run `npx @convex-dev/auth` (step 3) — it sets both keys |
| Auth not working after sign-up | Check that both `JWT_PRIVATE_KEY` and `JWKS` are set: `bunx convex env list` |
| OAuth redirect errors | Verify callback URLs match your Convex site URL |
| File uploads failing | Check all 4 R2 env vars are set in Convex dashboard and CORS is configured on the bucket |
| AI chat error | Verify `OPENROUTER_API_KEY` is set in Convex dashboard |
| `bunx convex dev` won't start | Run `bun install` first, ensure you're logged in to Convex |
