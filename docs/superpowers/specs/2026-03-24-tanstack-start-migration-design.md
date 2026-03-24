# Migration: Next.js → TanStack Start + Better Auth

**Date:** 2026-03-24
**Branch:** `migrate/tanstack-start`
**Approach:** In-place migration (Approach A)

## Summary

Migrate the Sherif Starter frontend from Next.js 16 (App Router) to TanStack Start, and replace Convex Auth (`@convex-dev/auth`) with Better Auth (`@convex-dev/better-auth`). The Convex backend, all services (email, storage, AI, notes), shadcn/ui components, and backend tests remain untouched.

## Motivation

- TanStack Start provides a Vite-native full-stack framework with file-based routing, SSR support, and server functions
- Better Auth is the officially supported auth solution for Convex + TanStack Start, with SSR auth, session cookies, and server-side token management
- The current app is 100% client-rendered (67 `"use client"` files, zero SSR/SSG), making the migration straightforward

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

## Data Migration Impact

**All existing user accounts, sessions, and auth tokens will be invalidated.** Better Auth uses different table schemas than `@convex-dev/auth`. This is a starter template — existing dev/test accounts must be recreated after migration. The test accounts in CLAUDE.md (`testuser@lucystarter.dev`, `testadmin@lucystarter.dev`) will need to be re-created via `/signup`.

## Design

### 1. Infrastructure & Build

| Current (Next.js) | New (TanStack Start) |
|---|---|
| `next.config.mjs` | `vite.config.ts` with `tanstackStart()` + `viteReact()` plugins |
| `next dev` / `next build` / `next start` | `vite dev` / `vite build` |
| `NEXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` |
| `eslint-config-next` | Remove (rewrite `eslint.config.mjs` with base eslint only) |
| `next-themes` | Keep (framework-agnostic) |
| `postcss.config.mjs` | Keep as-is (Vite supports PostCSS config files natively) |

**New dependencies:**
- `@tanstack/react-start`, `@tanstack/react-router`, `@vitejs/plugin-react`
- `@convex-dev/react-query`, `@tanstack/react-router-with-query`, `@tanstack/react-query`
- `@convex-dev/better-auth`, `better-auth@1.5.3`
- `vite`

**Remove:**
- `next`, `eslint-config-next`, `@convex-dev/auth`, `@auth/core`, `@edge-runtime/vm`

**Config file changes:**

| File | Change |
|---|---|
| `eslint.config.mjs` | Rewrite: remove `eslint-config-next` import, keep `no-restricted-imports` rule for convex files |
| `tsconfig.json` | Remove `next` plugin, remove `next-env.d.ts` and `.next/types` from includes, update target to `ES2022`, keep `@/*` path alias (Vite resolves via `resolve.tsconfigPaths: true` in vite.config) |
| `postcss.config.mjs` | No change (Vite reads it natively) |
| `vitest.config.ts` | No change (backend tests only, independent of frontend framework) |

### 2. Auth Migration (Convex Auth → Better Auth)

#### Auth Architecture

| Layer | Current | New |
|---|---|---|
| Server middleware | `proxy.ts` + Next.js edge middleware | TanStack Start `beforeLoad` + `getAuth()` server function (runs server-side during SSR, client-side during SPA navigation) |
| Client auth gate | `useConvexAuth()` in `(app)/layout.tsx` | `useSession()` from Better Auth client in `_app.tsx` layout route |
| Backend guards | `getAuthUserId()` from `@convex-dev/auth/server` | `getAuthUserId()` from `@convex-dev/better-auth` (same function name, different package) |
| Provider chain | `ConvexAuthNextjsServerProvider` → `ConvexAuthNextjsProvider` | `ConvexBetterAuthProvider` with `getAuth` server fn + `initialToken` |
| HTTP routes | `auth.addHttpRoutes(http)` | `authComponent.registerRoutes(http, createAuth)` |

#### `beforeLoad` Execution Context

TanStack Start's `beforeLoad` runs **server-side on initial page load** (SSR) and **client-side on subsequent SPA navigations**. For the auth guard in `_app.tsx`:
- **SSR**: `getToken()` reads the session cookie server-side via TanStack Start's server function
- **SPA navigation**: The auth state is already available client-side via `ConvexBetterAuthProvider`; `beforeLoad` checks the client-side session

This means the auth guard works in both contexts without separate implementations.

#### Auth Flow Changes

| Flow | Current | New |
|---|---|---|
| Sign up | `signIn("password", {email, password, flow: "signUp"})` | `authClient.signUp.email({email, password, name})` |
| Sign in | `signIn("password", {email, password, flow: "signIn"})` | `authClient.signIn.email({email, password})` |
| OAuth | `signIn("github")` | `authClient.signIn.social({provider: "github"})` |
| Password reset | Custom 2-step OTP flow (code entry + new password on same page) | Better Auth built-in: `authClient.forgetPassword({email})` sends reset email link → user clicks link → lands on `/reset-password?token=...` → `authClient.resetPassword({token, newPassword})` |
| Sign out | `signOut()` + redirect | `authClient.signOut()` + page reload (required with `expectAuth: true`) |
| Auth-aware rendering | `<Authenticated>`/`<Unauthenticated>` from `convex/react` | `useSession()` from Better Auth client → conditional rendering |
| Auth state check | `useConvexAuth()` → `{isAuthenticated, isLoading}` | `useSession()` → `{data: session, isPending}` |

**Password reset UI change:** The current forgot-password page is a 2-step form (email → OTP code + new password). Better Auth uses email links instead, which requires:
- The forgot-password page simplifies to just an email input
- A new `/reset-password` route handles the token from the email link and shows the new password form

**New route needed:** `src/routes/reset-password.tsx` for the reset password landing page.

#### Convex Backend Auth Changes

| File | Change |
|---|---|
| `convex/auth.ts` | Rewrite: `convexAuth()` → `betterAuth()` with `createAuth` factory. **Must preserve** the `afterUserCreatedOrUpdated` welcome email callback — use Better Auth's `user.create` hook to schedule `internal.email.logs.createEmailLog` |
| `convex/auth.config.ts` | Rewrite: new `getAuthConfigProvider` from `@convex-dev/better-auth` |
| `convex/authHelpers.ts` | Swap `getAuthUserId` import from `@convex-dev/auth/server` → `@convex-dev/better-auth` |
| `convex/http.ts` | Swap to `authComponent.registerRoutes(http, createAuth)` |
| `convex/convex.config.ts` | Add `app.use(betterAuth)` alongside `app.use(r2)` |
| `convex/schema.ts` | Remove `authTables` spread from `@convex-dev/auth`. Better Auth component manages its own tables internally. The `users` table with custom fields (`name`, `email`, `roles`, `avatarUrl`) remains — Better Auth populates it via its adapter. Verify field compatibility during implementation. |

#### Convex React Hooks

**`useQuery`, `useMutation`, `useAction` from `convex/react` continue to work.** The `@convex-dev/react-query` package is an additional layer for TanStack Query integration (SSR preloading via `useSuspenseQuery` + `convexQuery`), but it does not replace the existing Convex hooks. Existing page components can keep using `useQuery(api.notes.list)` etc. unchanged. Only route `loader` functions use the react-query wrapper for SSR preloading.

### 3. Routing Migration

#### File Mapping

| Current (Next.js App Router) | New (TanStack Start) | URL |
|---|---|---|
| `src/app/layout.tsx` | `src/routes/__root.tsx` | root layout |
| `src/app/page.tsx` | `src/routes/index.tsx` | `/` |
| `src/app/signin/page.tsx` | `src/routes/signin.tsx` | `/signin` |
| `src/app/signup/page.tsx` | `src/routes/signup.tsx` | `/signup` |
| `src/app/forgot-password/page.tsx` | `src/routes/forgot-password.tsx` | `/forgot-password` |
| — (new) | `src/routes/reset-password.tsx` | `/reset-password` |
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

The `_app.tsx` layout route checks auth via `beforeLoad`:

```ts
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    const session = context.session;
    if (!session) throw redirect({ to: '/signin' });
  },
  component: AppLayout,
});
```

The session is populated in the root route's `beforeLoad` via the `getAuth()` server function and passed through router context.

#### Import Swaps

| Current | New |
|---|---|
| `import Link from "next/link"` | `import { Link } from "@tanstack/react-router"` |
| `import { useRouter } from "next/navigation"` | `import { useNavigate } from "@tanstack/react-router"` |
| `router.replace("/path")` | `navigate({ to: "/path" })` |
| `import { usePathname } from "next/navigation"` | `import { useLocation } from "@tanstack/react-router"` |
| `"use client"` directive | Remove (default in TanStack Start) |
| `import { Plus_Jakarta_Sans } from "next/font/google"` | CSS `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap')` in `globals.css` |
| `import { Authenticated, Unauthenticated } from "convex/react"` | `useSession()` from `@/lib/auth-client` → conditional rendering |
| `import { useConvexAuth } from "convex/react"` | `useSession()` from Better Auth client |
| `import { useAuthActions } from "@convex-dev/auth/react"` | `import { authClient } from "@/lib/auth-client"` |

### 4. New Files

| File | Purpose |
|---|---|
| `vite.config.ts` | Vite config with `tanstackStart()` + `viteReact()`, SSR `noExternal: ['@convex-dev/better-auth']`, `resolve.tsconfigPaths: true` |
| `src/router.tsx` | TanStack Router setup with `ConvexQueryClient` (`expectAuth: true`), custom query defaults, `ConvexProvider` wrapper |
| `src/routes/__root.tsx` | Root layout: `<html>`, `<head>` with metadata, `ThemeProvider` (with `suppressHydrationWarning`), `ConvexBetterAuthProvider`, `Toaster` |
| `src/routes/_app.tsx` | Auth-gated layout route with `beforeLoad` guard, wraps children in `AppShell` |
| `src/routes/reset-password.tsx` | New route for Better Auth password reset landing page (`/reset-password?token=...`) |
| `src/lib/auth-client.ts` | Better Auth client instance with `convexClient()` plugin. **This is the auth seam** — all frontend auth imports go through this file, not directly from `better-auth`. |
| `src/lib/auth-server.ts` | Server utilities: `handler`, `getToken`, `fetchAuthQuery/Mutation/Action` from `convexBetterAuthReactStart` |
| `src/routes/api/auth/$.ts` | Catch-all route proxying auth requests from TanStack Start to Convex. Uses `handler` from `auth-server.ts`. Must forward headers/cookies correctly. |
| `convex/auth.ts` (rewrite) | Better Auth config with `createAuth` factory, `emailAndPassword: { enabled: true }`, OAuth providers, `user.create` hook for welcome email |

### 5. Files to Delete

| File | Reason |
|---|---|
| `src/proxy.ts` | Next.js middleware, replaced by TanStack Router `beforeLoad` |
| `src/app/` (entire directory) | Replaced by `src/routes/` |
| `next.config.mjs` | Replaced by `vite.config.ts` |
| `next-env.d.ts` | Next.js types, no longer needed |

**Note:** `src/app/globals.css` must be moved to `src/styles/globals.css` (or `src/globals.css`) **before** deleting `src/app/`. Update the import in `__root.tsx` accordingly.

### 6. Files Requiring Modification (not full rewrites)

| File | Change |
|---|---|
| `src/components/layout/sidebar.tsx` | Swap `Link` from `next/link` → `@tanstack/react-router`, swap `usePathname` → `useLocation` |
| `src/components/auth/user-menu.tsx` | Swap `useAuthActions` → `authClient` from `@/lib/auth-client`, change `signOut()` to `authClient.signOut()` |
| `src/components/providers.tsx` | Rewrite: remove Next.js-specific providers, create Convex + Better Auth + Theme provider chain |
| `eslint.config.mjs` | Remove `eslint-config-next` import, keep convex `no-restricted-imports` rule |
| `tsconfig.json` | Remove `next` plugin, `next-env.d.ts`, `.next/types` includes |
| `package.json` | Update scripts, swap deps |

### 7. Unchanged (~80% of codebase)

- All Convex services: `convex/notes.ts`, `convex/users.ts`, `convex/email/*`, `convex/storage/*`, `convex/ai/*`
- `convex/functions.ts` — custom builders (import swap only in `authHelpers.ts`)
- All `src/components/ui/*` — 60+ shadcn components
- `src/components/layout/app-shell.tsx`, `topbar.tsx`
- `src/lib/utils.ts`, `src/hooks/use-mobile.tsx`
- All `tests/convex/*` backend tests
- `postcss.config.mjs`, `vitest.config.ts`
- `public/` static assets (TanStack Start serves from `public/` identically)

### 8. Environment Variables

| Current | New |
|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `VITE_CONVEX_URL` |
| `CONVEX_DEPLOYMENT` | `CONVEX_DEPLOYMENT` (unchanged) |
| — | `BETTER_AUTH_SECRET` (new, generate via `openssl rand -base64 32`) |
| — | `VITE_CONVEX_SITE_URL` (new, Convex `.site` URL) |
| — | `VITE_SITE_URL` (new, app URL e.g. `http://localhost:3000`) |
| `SITE_URL` | `SITE_URL` (unchanged, used in Convex backend) |

### 9. Migration Order

1. **Infrastructure** — Install deps, create `vite.config.ts`, update `package.json` scripts, rewrite `eslint.config.mjs`, update `tsconfig.json`, move `globals.css` to `src/styles/`
2. **Auth backend** — Rewrite `convex/auth.ts`, `auth.config.ts`, `http.ts`, `convex.config.ts`, update `schema.ts` auth tables, update `authHelpers.ts` import. Preserve welcome email hook.
3. **Auth frontend** — Create `auth-client.ts`, `auth-server.ts`, API proxy route (`api/auth/$.ts`)
4. **Router skeleton** — Create `src/router.tsx`, `src/routes/__root.tsx` with providers + theme + toaster, basic index route
5. **Auth pages** — Migrate signin, signup, forgot-password. Create new `reset-password` route.
6. **Protected layout** — Create `_app.tsx` with `beforeLoad` guard
7. **App pages** — Migrate dashboard, notes, files, ai-chat, data-grid-demo
8. **Admin pages** — Migrate admin/users, admin/emails, admin/email-templates
9. **Component import swaps** — Update sidebar (`Link`, `usePathname`), user-menu (`signOut`), providers.tsx
10. **Landing page** — Migrate root page: replace `next/font/google` with CSS import, replace `Authenticated`/`Unauthenticated` with `useSession()`, replace `next/link` and `useRouter`
11. **Smoke test** — Run the app, verify all routes load, auth flows work, protected routes redirect correctly
12. **Cleanup** — Delete `src/app/`, `src/proxy.ts`, `next.config.mjs`, `next-env.d.ts`, remove Next.js deps from `package.json`
13. **Update CLAUDE.md** — Reflect new stack, file structure, auth patterns, updated test account instructions
