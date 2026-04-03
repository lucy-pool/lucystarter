# Selective SSR on Cloudflare Workers

**Date:** 2026-04-03
**Status:** Approved
**Goal:** Switch from SPA mode to Selective SSR with `defaultSsr: false`, deployed on Cloudflare Workers. Routes are client-rendered by default; opt in to SSR per route.

## Motivation

Business apps need flexibility: SEO on public pages, fast first paint for dashboards, server functions for auth and webhooks. SPA mode locks you out of all server-side capabilities. Selective SSR gives the best of both: client-rendered by default (like SPA), with SSR available when needed.

Cloudflare Workers provides a server runtime with ~0ms cold starts, 100k free requests/day, and V8 isolates (not containers).

## Changes

### 1. Vite Config (`vite.config.ts`)

- Remove `spa: { enabled: true }`
- Keep the dev proxy for `/api/auth` (still useful for local dev)
- Restore `ssr.noExternal: ["@convex-dev/better-auth"]` (needed for SSR bundle)
- Keep `ssr.noExternal: ["tailwindcss"]` (fixes the build error)

### 2. Selective SSR Config (`src/start.ts`)

Create `src/start.ts`:

```ts
import { createStart } from "@tanstack/react-start";

export const start = createStart(() => ({
  defaultSsr: false,
}));
```

All routes are client-rendered by default. Any route can opt in:

```ts
export const Route = createFileRoute("/marketing")({
  ssr: true,
  component: MarketingPage,
});
```

### 3. Restore Server-Side Auth Proxy

**Restore `src/lib/auth-server.ts`:**

```ts
import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
});
```

**Restore `src/routes/api/auth/$.ts`:**

```ts
import { createFileRoute } from "@tanstack/react-router";
import { handler } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
```

**Delete `functions/api/auth/[[path]].ts`** — the Cloudflare Pages edge function is replaced by the server function above.

### 4. Root Route SSR Auth (`src/routes/__root.tsx`)

Restore `beforeLoad` with `createServerFn` for SSR token passing:

```ts
import { createServerFn } from "@tanstack/react-start";
import { getToken } from "@/lib/auth-server";

const getAuth = createServerFn({ method: "GET" }).handler(async () => {
  return await getToken();
});
```

In the route definition, add `beforeLoad`:

```ts
beforeLoad: async (ctx) => {
  const token = await getAuth();
  if (token) {
    ctx.context.convexQueryClient.serverHttpClient?.setAuth(token);
  }
  return { isAuthenticated: !!token, token };
},
```

And pass `initialToken` to `ConvexBetterAuthProvider`:

```tsx
<ConvexBetterAuthProvider
  client={context.convexQueryClient.convexClient}
  authClient={authClient}
  initialToken={context.token}
>
```

### 5. Package Scripts (`package.json`)

- Change `"start"` back to `"node .output/server/index.mjs"`
- Add `"deploy": "wrangler deploy"` script

### 6. Wrangler Config (`wrangler.toml`)

```toml
name = "lucystarter"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]
main = ".output/server/index.mjs"

[assets]
directory = ".output/public"
```

### 7. TypeScript Config (`tsconfig.json`)

Remove `"functions"` from the `exclude` array (the `functions/` directory is being deleted).

### 8. Documentation (`CLAUDE.md`)

- Update deployment target from Cloudflare Pages to Cloudflare Workers
- Update Layer 2 auth section back to server function
- Add `src/start.ts` and `wrangler.toml` to architecture tree
- Remove `functions/` from architecture tree
- Restore `src/lib/auth-server.ts` in architecture tree
- Document Selective SSR pattern (defaultSsr: false, opt-in per route)

## Files Summary

| Action | File |
|--------|------|
| Modify | `vite.config.ts` — remove SPA mode, restore SSR config |
| Create | `src/start.ts` — defaultSsr: false |
| Restore | `src/lib/auth-server.ts` — server-side auth helpers |
| Restore | `src/routes/api/auth/$.ts` — server-side auth proxy |
| Modify | `src/routes/__root.tsx` — restore beforeLoad SSR auth |
| Modify | `package.json` — update scripts, add wrangler dep |
| Create | `wrangler.toml` — Workers deployment config |
| Delete | `functions/api/auth/[[path]].ts` |
| Modify | `tsconfig.json` — remove functions exclusion |
| Modify | `CLAUDE.md` — update docs |

## Verification

1. `bun run typecheck` — passes
2. `bun run test` — all tests pass
3. `bun run lint` — passes
4. `bun run build` — produces `.output/server/` and `.output/public/`
5. Manual: sign in, sign out, protected routes work
6. SSR test: add `ssr: true` to a route, view source shows server-rendered HTML

## Out of Scope

- Actual Workers deployment (wrangler deploy)
- Adding SSR to specific routes (this just enables the capability)
- Workers KV or Durable Objects configuration
