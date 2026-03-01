# Authentication Flow

## Sign-In Sequence

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as Clerk
    participant M as Edge Proxy (proxy.ts)
    participant A as (app)/layout.tsx
    participant X as Convex

    B->>C: User signs in at /sign-in
    C->>B: JWT issued, redirect to /dashboard
    B->>M: Request /dashboard
    M->>M: clerkMiddleware checks auth (proxy.ts)
    M->>B: Route allowed (authenticated)
    B->>A: Render (app)/layout.tsx
    A->>X: useMutation(getOrCreateUser)
    X->>X: Check users.by_clerk_id index
    alt User exists
        X->>A: Return existing user
    else First sign-in
        X->>X: Insert new user (role: "user")
        X->>A: Return new user
    end
    A->>X: useQuery(getCurrentUser)
    X->>A: User record
    A->>B: Render AppShell + dashboard
```

## Route Protection

```mermaid
graph TD
    request[Incoming Request] --> proxy["proxy.ts (clerkMiddleware)"]
    proxy --> isPublic{Is public route?}

    isPublic -->|"/ or /sign-in or /sign-up"| allow[Allow through]
    isPublic -->|Any other route| protect["auth().protect()"]

    protect --> hasSession{Has valid session?}
    hasSession -->|Yes| appLayout["(app)/layout.tsx"]
    hasSession -->|No| redirect[Redirect to /sign-in]

    appLayout --> provision[getOrCreateUser mutation]
    provision --> waitUser[Wait for user record]
    waitUser --> render[Render AppShell + page]
```

## JWT Flow

```mermaid
graph LR
    Clerk -->|"Issues JWT with subject=clerkId"| Browser
    Browser -->|"JWT in Authorization header"| Convex
    Convex -->|"auth.config.ts validates against CLERK_JWT_ISSUER_DOMAIN"| Identity["ctx.auth.getUserIdentity()"]
    Identity -->|"identity.subject = clerkId"| Lookup["users.by_clerk_id index"]
```

## Key Files

| File | Role |
|------|------|
| `convex/auth.config.ts` | Clerk JWT provider config |
| `convex/auth.ts` | Auth guards (getCurrentUser, requireAuth, requireAdmin) |
| `convex/users.ts` | getOrCreateUser auto-provisioning |
| `src/proxy.ts` | Edge proxy — route protection (public vs protected) |
| `src/components/providers.tsx` | ConvexProviderWithClerk wiring |
| `src/app/(app)/layout.tsx` | Auth gate + user provisioning on mount |
| `src/app/sign-in/[[...rest]]/page.tsx` | Clerk SignIn component |
| `src/app/sign-up/[[...rest]]/page.tsx` | Clerk SignUp component |
