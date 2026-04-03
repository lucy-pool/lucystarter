# SPA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Switch TanStack Start from SSR to SPA mode for static Cloudflare Pages deployment, with a same-origin edge proxy for auth.

**Architecture:** Remove all server-side code (auth proxy, SSR token fetch). Enable TanStack Start SPA mode for static output. Add a Vite dev proxy for `/api/auth` and a Cloudflare Pages Function for production.

**Tech Stack:** TanStack Start v1.167+, Vite, Cloudflare Pages Functions, Better Auth

**Spec:** `docs/superpowers/specs/2026-04-03-spa-migration-design.md`

---

### Task 1: Enable SPA Mode in Vite Config

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Update vite.config.ts to enable SPA mode and add auth proxy**

Replace the entire contents of `vite.config.ts` with:

```ts
import path from "path";
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
    proxy: {
      "/api/auth": {
        target: process.env.VITE_CONVEX_SITE_URL,
        changeOrigin: true,
      },
    },
  },
  plugins: [
    tanstackStart({
      spa: { enabled: true },
    }),
    react(),
  ],
  resolve: {
    alias: [
      { find: "@/convex", replacement: path.resolve(__dirname, "./convex") },
      { find: "@/", replacement: path.resolve(__dirname, "./src") + "/" },
    ],
  },
});
```

Changes from current:
- Added `spa: { enabled: true }` to `tanstackStart()`
- Added `proxy` block for `/api/auth` pointing to `VITE_CONVEX_SITE_URL`
- Removed `ssr.noExternal` config (no SSR build)

- [ ] **Step 2: Verify config is valid**

Run: `bunx vite build --dry-run 2>&1 || bun run typecheck`

Expected: No config-level errors. Typecheck may still fail until server code is removed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "feat: enable TanStack Start SPA mode with auth dev proxy"
```

---

### Task 2: Remove Server-Side Code

**Files:**
- Delete: `src/routes/api/auth/$.ts`
- Delete: `src/lib/auth-server.ts`
- Modify: `src/routes/__root.tsx`

- [ ] **Step 1: Delete the server-side auth proxy route**

Delete `src/routes/api/auth/$.ts`. This file proxied Better Auth requests to the Convex HTTP backend during SSR. The Vite dev proxy (Task 1) and Cloudflare Pages Function (Task 3) replace it.

- [ ] **Step 2: Delete the server-side auth helpers**

Delete `src/lib/auth-server.ts`. This file exported `handler`, `getToken`, `fetchAuthQuery`, `fetchAuthMutation`, `fetchAuthAction` — all SSR-only utilities from `@convex-dev/better-auth/react-start`.

- [ ] **Step 3: Rewrite __root.tsx to remove all server-side code**

Replace the entire contents of `src/routes/__root.tsx` with:

```tsx
/// <reference types="vite/client" />
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import * as React from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import appCss from "@/styles/globals.css?url";
import { authClient } from "@/lib/auth-client";
import { ThemeProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
  convexQueryClient: ConvexQueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      { title: "Sherif Starter" },
      {
        name: "description",
        content: "Full-stack starter with Convex, TanStack Start, and Better Auth",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico" },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  const context = Route.useRouteContext();
  return (
    <ConvexBetterAuthProvider
      client={context.convexQueryClient.convexClient}
      authClient={authClient}
    >
      <RootDocument>
        <ThemeProvider>
          <Outlet />
          <Toaster />
        </ThemeProvider>
      </RootDocument>
    </ConvexBetterAuthProvider>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
```

Changes from current:
- Removed `createServerFn` import from `@tanstack/react-start`
- Removed `getToken` import from `@/lib/auth-server`
- Removed `getAuth` server function
- Removed `beforeLoad` hook (SSR token fetch)
- Removed `initialToken` prop from `ConvexBetterAuthProvider`
- Removed `useRouteContext` import (using `Route.useRouteContext()` instead)

- [ ] **Step 4: Verify no remaining references to deleted files**

Run: `grep -r "auth-server" src/` — should return nothing.
Run: `grep -r "createServerFn" src/` — should return nothing.

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`

Expected: PASS (no type errors)

- [ ] **Step 6: Run existing backend tests**

Run: `bun run test`

Expected: All tests pass (backend tests don't depend on SSR code).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: remove SSR server code for SPA migration"
```

---

### Task 3: Create Cloudflare Pages Edge Proxy

**Files:**
- Create: `functions/api/auth/[[path]].ts`

- [ ] **Step 1: Create the Cloudflare Pages Functions directory and proxy file**

Create `functions/api/auth/[[path]].ts`:

```ts
// Cloudflare Pages Function — proxies /api/auth/* to Convex HTTP backend.
// This keeps auth cookies on the same origin (no cross-origin cookie issues).

export const onRequest: PagesFunction<{
  CONVEX_SITE_URL: string;
}> = async ({ request, env }) => {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.CONVEX_SITE_URL);

  const res = await fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" ? request.body : undefined,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add functions/api/auth/\[\[path\]\].ts
git commit -m "feat: add Cloudflare Pages edge proxy for auth"
```

---

### Task 4: Update package.json Scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Update the start script**

In `package.json`, change the `"start"` script. The SSR server entry (`node .output/server/index.mjs`) no longer exists in SPA mode. Replace with a static preview server for local testing of production builds:

Change:
```json
"start": "node .output/server/index.mjs",
```

To:
```json
"start": "vite preview --port 3000",
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: update start script for SPA static preview"
```

---

### Task 5: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Environment Variables section**

In the Environment Variables table in `CLAUDE.md`, add note that `CONVEX_SITE_URL` is needed for Cloudflare Pages deployment. The table currently lists `VITE_CONVEX_SITE_URL` in `.env.local` — that stays. Add:

| Variable | Where | Purpose |
|----------|-------|---------|
| `CONVEX_SITE_URL` | Cloudflare Pages env | Auth proxy target (edge function) |

- [ ] **Step 2: Update Architecture section**

In the Architecture file tree, replace:

```
  api/auth/$.ts                  # API catch-all — proxies Better Auth requests to Convex
```

With:

```
functions/                       # Cloudflare Pages Functions
  api/auth/[[path]].ts           # Edge proxy — forwards /api/auth/* to Convex HTTP backend
```

Remove `src/lib/auth-server.ts` from the tree.

- [ ] **Step 3: Update Security Layer 2 description**

Replace the Layer 2 section content to reflect the edge proxy instead of the API route:

> **Layer 2: Auth Edge Proxy (`functions/api/auth/[[path]].ts`)**
>
> - Cloudflare Pages Function that proxies `/api/auth/*` to the Convex HTTP backend
> - Keeps auth cookies on the same origin (no cross-origin issues)
> - In local dev, Vite's `server.proxy` config handles the same forwarding
> - No manual auth logic — Better Auth handles session tokens via cookies

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for SPA mode and edge proxy"
```

---

### Task 6: Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Kill any running dev servers**

```bash
pkill -f "convex dev" 2>/dev/null; pkill -f "vite" 2>/dev/null
```

- [ ] **Step 2: Start both servers**

```bash
bunx convex dev &
bun run dev &
```

Wait for both to be ready.

- [ ] **Step 3: Verify sign-up flow**

Navigate to `http://localhost:3000/signup`. Create a new account or use test credentials (`testuser@lucystarter.dev` / `TestUser123!`). Expected: redirects to `/dashboard` after sign-up/sign-in.

- [ ] **Step 4: Verify protected route access**

Navigate to `http://localhost:3000/files` while authenticated. Expected: Files page loads with upload dropzone.

- [ ] **Step 5: Verify unauthenticated redirect**

Sign out, then navigate to `http://localhost:3000/dashboard`. Expected: redirects to `/signin`.

- [ ] **Step 6: Verify landing page**

Navigate to `http://localhost:3000/`. Expected: landing page renders without errors.

- [ ] **Step 7: Run full test suite**

```bash
bun run test
bun run typecheck
bun run lint
```

Expected: All pass.
