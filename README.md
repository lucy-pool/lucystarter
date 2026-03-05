# Convex + Clerk Starter Template

A production-ready starter for building full-stack apps with **Convex**, **Next.js 16**, **Clerk**, and **shadcn/ui**. Comes with authentication, user provisioning, role-based access, Cloudflare R2 file uploads, OpenRouter AI integration, demo features for each pattern, and an auto-maintained documentation system that keeps architecture diagrams in sync with your code.

## What You Get

### Auth — fully wired, zero config

Sign-up, sign-in, and session management via Clerk. Users are auto-provisioned in your Convex database on first sign-in. Protected routes just work — anything under `(app)/` requires authentication.

### Roles — one place to change

Roles live in `convex/schema.ts` as a single `ROLES` array and `roleValidator`. New users get the `user` role. Admins can promote others. Add roles (editor, manager, whatever) by editing one file — the type system propagates everywhere.

### Backend guards — composable

`requireAuth(ctx)` for any signed-in user. `requireAdmin(ctx)` for admins. `hasRole(ctx, "someRole")` for boolean checks. Add your own guards following the same pattern.

### Cloudflare R2 file uploads — presigned URL pattern

Files go directly from browser to R2. Convex stores metadata only, never file bytes. The demo shows the full flow using `@convex-dev/r2`: get presigned URL → upload with progress tracking → store metadata.

### OpenRouter AI — chat completions

Call any LLM via OpenRouter's OpenAI-compatible API. The demo shows the action pattern for external API calls, conversation history stored in Convex, and a working chat UI.

### Three demo features — copy the patterns, then delete them

| Demo | Pattern it teaches |
|------|--------------------|
| **Notes** | Convex CRUD, queries with indexes, mutations with auth guards, ownership checks, real-time updates |
| **Files** | `@convex-dev/r2` component, presigned R2 URLs, direct browser upload, progress tracking, metadata storage |
| **AI Chat** | External API calls from actions, conversation history, loading states, streaming-ready architecture |

### shadcn/ui — 15 components ready

Button, Card, Dialog, Input, Textarea, Badge, Select, Tabs, Table, Label, Progress, Alert Dialog, Toast, Toaster. Add more with `bunx shadcn@latest add [component]`.

### Auto-maintained architecture diagrams

A Stop hook watches what files you change and spawns a background agent to update mermaid diagrams in `memory/ai/diagrams/`. Four diagrams ship with the template:

| Diagram | What it documents |
|---------|-------------------|
| `schema.md` | ER diagram of all tables, indexes, and roles |
| `functions.md` | Every Convex function — type, auth level, which tables it touches |
| `auth-flow.md` | Sign-in sequence, route protection, JWT validation |
| `data-flow.md` | How data moves from browser through Convex and back |

These update automatically. When you add a table, the schema diagram updates. When you add a function, the functions diagram updates. The agent always starts with accurate context.

### Code quality hooks

The Stop hook also runs before you can move on:
1. **TypeScript typecheck** — catches type errors
2. **Convex typecheck** — catches schema/function mismatches
3. **Unused import check** — flags dead imports from `convex/_generated`
4. **Client import check** — blocks React/Next.js imports in server-side Convex code

## Project Structure

```
convex/                        # Backend (runs on Convex servers)
  schema.ts                    # Tables, indexes, role + fileType validators
  auth.config.ts               # Clerk JWT provider config
  auth.ts                      # Auth guards (requireAuth, requireAdmin, hasRole)
  users.ts                     # User CRUD + auto-provisioning
  convex.config.ts               # App definition — registers R2 component
  files.ts                     # File metadata CRUD (queries/mutations)
  r2.ts                        # R2 client + clientApi exports (generateUploadUrl, syncMetadata)
  r2Actions.ts                 # "use node" — R2 presigned download URLs
  ai.ts                        # AI message history CRUD (queries/mutations)
  aiActions.ts                 # "use node" — OpenRouter chat completions
  notes.ts                     # Demo CRUD — delete when building your app
  util.ts                      # Error classes (ConvexError, ValidationError, etc.)

src/app/                       # Frontend (Next.js App Router)
  layout.tsx                   # Root: ClerkProvider → ConvexClientProvider → Toaster
  page.tsx                     # Landing page (redirects to /dashboard if signed in)
  sign-in/[[...rest]]/         # Clerk sign-in page
  sign-up/[[...rest]]/         # Clerk sign-up page
  (app)/                       # Protected routes (require authentication)
    layout.tsx                 # Auth gate + auto user provisioning
    dashboard/page.tsx         # Welcome + demo feature links
    notes/page.tsx             # Demo: CRUD — delete when building your app
    files/page.tsx             # Demo: R2 upload — delete when building your app
    ai-chat/page.tsx           # Demo: OpenRouter chat — delete when building your app

src/components/
  providers.tsx                # ConvexProviderWithClerk wiring
  layout/
    app-shell.tsx              # Sidebar + topbar + content wrapper
    sidebar.tsx                # Navigation — add your routes here
    topbar.tsx                 # Clerk UserButton
  ui/                          # 15 shadcn/ui components

src/lib/
  utils.ts                     # cn() class merging utility

.claude/hooks/
  stop-hook.ts                 # Stop hook: typecheck, lint, diagram updates
  block-*.sh                   # PreToolUse hooks: enforce CLI tool usage rules

memory/ai/diagrams/            # Auto-maintained architecture docs
  schema.md
  functions.md
  auth-flow.md
  data-flow.md
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- A [Clerk](https://clerk.com) account
- A [Convex](https://convex.dev) account

### Setup

```bash
# 1. Install dependencies
bun install

# 2. Create your env file
cp .env.example .env.local
```

Edit `.env.local` with your Clerk keys:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev
```

### Clerk Setup

1. Create a Clerk application at [dashboard.clerk.com](https://dashboard.clerk.com)
2. Copy the publishable and secret keys to `.env.local`
3. In Clerk Dashboard → JWT Templates, create a template named **"convex"**
4. Set the issuer to your Clerk domain (e.g. `https://your-domain.clerk.accounts.dev`)
5. In the Convex dashboard, add your Clerk issuer domain under Settings → Authentication

### Run

```bash
# Terminal 1 — starts Convex (pushes schema, watches for changes)
bunx convex dev

# Terminal 2 — starts Next.js
bun dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and you'll land on the dashboard.

## Building Your App

### 1. Define your roles

Edit `convex/schema.ts`:

```typescript
export const ROLES = ["user", "editor", "admin"] as const;
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("editor"),
  v.literal("admin")
);
```

### 2. Add a table

In `convex/schema.ts`, add to the `defineSchema` call:

```typescript
projects: defineTable({
  name: v.string(),
  ownerId: v.id("users"),
  status: v.union(v.literal("active"), v.literal("archived")),
  createdAt: v.number(),
})
  .index("by_owner", ["ownerId"])
  .index("by_status", ["status"]),
```

### 3. Write backend functions

Create `convex/projects.ts`:

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./auth";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);
    return ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

export const create = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    return ctx.db.insert("projects", {
      name: args.name,
      ownerId: user._id,
      status: "active",
      createdAt: Date.now(),
    });
  },
});
```

### 4. Create a page

Create `src/app/(app)/projects/page.tsx`:

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export default function ProjectsPage() {
  const projects = useQuery(api.projects.list);
  const createProject = useMutation(api.projects.create);
  // ... your UI
}
```

### 5. Add it to the sidebar

In `src/components/layout/sidebar.tsx`, add to `navItems`:

```typescript
{
  label: "Projects",
  href: "/projects",
  icon: <FolderOpen className="h-5 w-5" />,
},
```

### 6. Delete the demos

Remove the demo files you don't need:
- Notes: `convex/notes.ts`, `src/app/(app)/notes/`, `notes` table from schema
- Files: keep `convex/files.ts` + `convex/r2.ts` + `convex/r2Actions.ts` if you need uploads, delete the demo page `src/app/(app)/files/`
- AI: keep `convex/ai.ts` + `convex/aiActions.ts` if you need AI, delete the demo page `src/app/(app)/ai-chat/`

## Convex Cheat Sheet

| Concept | Rule |
|---------|------|
| **Queries** | Reactive, re-run on data change. No side effects. |
| **Mutations** | Transactional. No `fetch()` or external API calls. |
| **Actions** | For side effects (APIs, email, etc). Use `ctx.runQuery()`/`ctx.runMutation()` for DB. |
| **`"use node"` files** | Only export actions. Required for Node.js packages (e.g. email SDKs). |
| **New fields** | Use `v.optional()` when adding fields to tables that already have data. |
| **Scheduling** | Use `ctx.scheduler.runAfter(0, ...)` from mutations for async background work. |
| **Action → Action** | Anti-pattern. Inline the logic or schedule from a mutation. |

## Environment Variables

| Variable | Location | Description |
|----------|----------|-------------|
| `CONVEX_DEPLOYMENT` | `.env.local` | Auto-set by `bunx convex dev` |
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` | Auto-set by `bunx convex dev` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env.local` | From Clerk dashboard |
| `CLERK_SECRET_KEY` | `.env.local` | From Clerk dashboard |
| `CLERK_JWT_ISSUER_DOMAIN` | Convex dashboard env | Your Clerk issuer domain |
| `R2_ENDPOINT` | Convex dashboard env | Cloudflare R2 S3-compatible endpoint URL |
| `R2_ACCESS_KEY_ID` | Convex dashboard env | R2 API token access key ID |
| `R2_SECRET_ACCESS_KEY` | Convex dashboard env | R2 API token secret access key |
| `R2_BUCKET` | Convex dashboard env | R2 bucket name |
| `OPENROUTER_API_KEY` | Convex dashboard env | OpenRouter API key |
| `DEFAULT_OPENROUTER_MODEL` | Convex dashboard env | Default model (default: devstral free) |

Backend-only secrets go in the Convex dashboard:

```bash
bunx convex env set R2_ENDPOINT https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
bunx convex env set R2_ACCESS_KEY_ID your-access-key-id
bunx convex env set R2_SECRET_ACCESS_KEY your-secret-access-key
bunx convex env set R2_BUCKET your-bucket-name
bunx convex env set OPENROUTER_API_KEY sk-or-v1-...
```

## License

MIT
