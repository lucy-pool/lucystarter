# Migration: Next.js → TanStack Start + Better Auth

**Date:** 2026-03-24
**Branch:** `migrate/tanstack-start`
**Approach:** In-place migration (Approach A)

## Summary

Migrate the Sherif Starter frontend from Next.js 16 (App Router) to TanStack Start, and replace Convex Auth (`@convex-dev/auth`) with Better Auth (`@convex-dev/better-auth`). The Convex backend, all services (email, storage, AI, notes), shadcn/ui components, and backend tests remain untouched.

## Motivation

- TanStack Start provides a Vite-native full-stack framework with file-based routing, SSR support, and server functions
- Better Auth is the officially supported auth solution for Convex + TanStack Start, with SSR auth, session cookies, and server-side token management
- The current app is 100% client-rendered (66 `"use client"` files, zero SSR/SSG), making the migration straightforward

## Scope

**In scope:**
- Replace Next.js with TanStack Start (build, routing, config)
- Replace Convex Auth with Better Auth (auth config, providers, sign-in flows)
- Migrate all 14 pages (landing, signin, signup, forgot-password, dashboard, notes, files, ai-chat, data-grid-demo, admin/users, admin/emails, admin/email-templates)
- Update provider chain and auth wiring
- Update CLAUDE.md to reflect new stack

**Out of scope:**
- Convex backend logic (queries, mutations, actions)
- shadcn/ui components
- Backend tests
- Email, storage, AI services
- Adding new features

## Design

### 1. Infrastructure & Build

| Current (Next.js) | New (TanStack Start) |
|---|---|
| `next.config.ts` | `vite.config.ts` with `tanstackStart()` + `viteReact()` plugins |
| `next dev` / `next build` / `next start` | `vite dev` / `vite build` |
| `NEXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` |
| `eslint-config-next` | Remove |
| `next-themes` | Keep (framework-agnostic) |

**New dependencies:**
- `@tanstack/react-start`, `@tanstack/react-router`, `@vitejs/plugin-react`
- `@convex-dev/react-query`, `@tanstack/react-router-with-query`, `@tanstack/react-query`
- `@convex-dev/better-auth`, `better-auth@1.5.3`
- `vite`

**Remove:**
- `next`, `eslint-config-next`, `@convex-dev/auth`, `@auth/core`, `@edge-runtime/vm`

### 2. Auth Migration (Convex Auth → Better Auth)

#### Auth Architecture

| Layer | Current | New |
|---|---|---|
| Server middleware | `proxy.ts` + Next.js edge middleware | TanStack Router `beforeLoad` + `getToken()` server function |
| Client auth gate | `useConvexAuth()` in `(app)/layout.tsx` | TanStack Router layout route with auth check |
| Backend guards | `getAuthUserId()` from `@convex-dev/auth/server` | `getAuthUserId()` from Better Auth equivalent |
| Provider chain | `ConvexAuthNextjsServerProvider` → `ConvexAuthNextjsProvider` | `ConvexBetterAuthProvider` with `getAuth` server fn |
| HTTP routes | `auth.addHttpRoutes(http)` | `authComponent.registerRoutes(http, createAuth)` |

#### Auth Flow Changes

| Flow | Current | New |
|---|---|---|
| Sign up | `signIn("password", {email, password, flow: "signUp"})` | `authClient.signUp.email({email, password, name})` |
| Sign in | `signIn("password", {email, password, flow: "signIn"})` | `authClient.signIn.email({email, password})` |
| OAuth | `signIn("github")` | `authClient.signIn.social({provider: "github"})` |
| Password reset | Custom 2-step OTP via `Email` provider | Built-in `authClient.forgetPassword` + `authClient.resetPassword` |
| Sign out | `signOut()` + redirect | `authClient.signOut()` + page reload |

#### Convex Backend Auth Changes

| File | Change |
|---|---|
| `convex/auth.ts` | Rewrite: `convexAuth()` → `betterAuth()` with `createAuth` factory |
| `convex/auth.config.ts` | Rewrite: new `getAuthConfigProvider` from Better Auth |
| `convex/authHelpers.ts` | Swap `getAuthUserId` import source |
| `convex/http.ts` | Swap to `authComponent.registerRoutes(http, createAuth)` |
| `convex/convex.config.ts` | Add `app.use(betterAuth)` alongside `app.use(r2)` |
| `convex/schema.ts` | Replace `authTables` with Better Auth component tables |

### 3. Routing Migration

#### File Mapping

| Current (Next.js App Router) | New (TanStack Start) | URL |
|---|---|---|
| `src/app/layout.tsx` | `src/routes/__root.tsx` | root layout |
| `src/app/page.tsx` | `src/routes/index.tsx` | `/` |
| `src/app/signin/page.tsx` | `src/routes/signin.tsx` | `/signin` |
| `src/app/signup/page.tsx` | `src/routes/signup.tsx` | `/signup` |
| `src/app/forgot-password/page.tsx` | `src/routes/forgot-password.tsx` | `/forgot-password` |
| `src/app/(app)/layout.tsx` | `src/routes/_app.tsx` | auth-gated layout |
| `src/app/(app)/dashboard/page.tsx` | `src/routes/_app/dashboard.tsx` | `/dashboard` |
| `src/app/(app)/notes/page.tsx` | `src/routes/_app/notes.tsx` | `/notes` |
| `src/app/(app)/files/page.tsx` | `src/routes/_app/files.tsx` | `/files` |
| `src/app/(app)/ai-chat/page.tsx` | `src/routes/_app/ai-chat.tsx` | `/ai-chat` |
| `src/app/(app)/data-grid-demo/page.tsx` | `src/routes/_app/data-grid-demo.tsx` | `/data-grid-demo` |
| `src/app/(app)/admin/users/page.tsx` | `src/routes/_app/admin/users.tsx` | `/admin/users` |
| `src/app/(app)/admin/emails/page.tsx` | `src/routes/_app/admin/emails.tsx` | `/admin/emails` |
| `src/app/(app)/admin/email-templates/page.tsx` | `src/routes/_app/admin/email-templates.tsx` | `/admin/email-templates` |

#### Route Protection

The `_app.tsx` layout route checks auth server-side via `beforeLoad`:

```ts
export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const token = await getToken();
    if (!token) throw redirect({ to: '/signin' });
  },
  component: AppLayout,
});
```

#### Import Swaps

| Current | New |
|---|---|
| `import Link from "next/link"` | `import { Link } from "@tanstack/react-router"` |
| `import { useRouter } from "next/navigation"` | `import { useNavigate } from "@tanstack/react-router"` |
| `router.replace("/path")` | `navigate({ to: "/path" })` |
| `import { usePathname } from "next/navigation"` | `import { useLocation } from "@tanstack/react-router"` |
| `"use client"` directive | Remove (default in TanStack Start) |

### 4. New Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite config with `tanstackStart()` + `viteReact()` + SSR noExternal |
| `src/router.tsx` | TanStack Router setup with ConvexQueryClient, auth integration |
| `src/routes/__root.tsx` | Root layout: HTML shell, providers, head metadata |
| `src/routes/_app.tsx` | Auth-gated layout route with `beforeLoad` guard |
| `src/lib/auth-client.ts` | Better Auth client instance with `convexClient()` plugin |
| `src/lib/auth-server.ts` | Server utilities: `handler`, `getToken`, `fetchAuthQuery/Mutation/Action` |
| `src/routes/api/auth/$.ts` | Catch-all route proxying auth requests to Convex |
| `convex/auth.ts` (rewrite) | Better Auth config with `createAuth` factory |

### 5. Files to Delete

| File | Reason |
|---|---|
| `src/proxy.ts` | Next.js middleware, replaced by TanStack Router `beforeLoad` |
| `src/app/` (entire directory) | Replaced by `src/routes/` |
| `next.config.ts` | Replaced by `vite.config.ts` |
| `next-env.d.ts` | Next.js types, no longer needed |

### 6. Unchanged (~85% of codebase)

- All Convex services: `convex/notes.ts`, `convex/users.ts`, `convex/email/*`, `convex/storage/*`, `convex/ai/*`
- `convex/functions.ts` — custom builders (import swap only in `authHelpers.ts`)
- All `src/components/ui/*` — 60+ shadcn components
- `src/components/layout/app-shell.tsx`, `topbar.tsx`
- `src/lib/utils.ts`, `src/hooks/use-mobile.tsx`
- All `tests/convex/*` backend tests
- Tailwind CSS config, `globals.css`

### 7. Environment Variables

| Current | New |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` |
| `CONVEX_DEPLOYMENT` | `CONVEX_DEPLOYMENT` (unchanged) |
| — | `BETTER_AUTH_SECRET` (new, generate via `openssl rand -base64 32`) |
| — | `VITE_CONVEX_SITE_URL` (new, Convex `.site` URL) |
| — | `VITE_SITE_URL` (new, app URL e.g. `http://localhost:3000`) |
| `SITE_URL` | `SITE_URL` (unchanged, used in Convex backend) |

### 8. Migration Order

1. **Infrastructure** — Install deps, create `vite.config.ts`, update `package.json` scripts, update `tsconfig.json`
2. **Router skeleton** — Create `src/router.tsx`, `src/routes/__root.tsx`, basic index route
3. **Auth backend** — Rewrite `convex/auth.ts`, `auth.config.ts`, `http.ts`, `convex.config.ts`, `schema.ts` auth tables
4. **Auth frontend** — Create `auth-client.ts`, `auth-server.ts`, API proxy route, wire providers
5. **Auth pages** — Migrate signin, signup, forgot-password
6. **Protected layout** — Create `_app.tsx` with `beforeLoad` guard
7. **App pages** — Migrate dashboard, notes, files, ai-chat, data-grid-demo
8. **Admin pages** — Migrate admin/users, admin/emails, admin/email-templates
9. **Component import swaps** — Update sidebar, user-menu, any remaining `next/link` or `next/navigation` imports
10. **Landing page** — Migrate root page with auth-aware redirects
11. **Cleanup** — Delete `src/app/`, `src/proxy.ts`, `next.config.ts`, `next-env.d.ts`, remove Next.js deps
12. **Update CLAUDE.md** — Reflect new stack, file structure, auth patterns
