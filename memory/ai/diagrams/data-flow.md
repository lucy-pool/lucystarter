# Data Flow

## Client → Convex Reactive Loop

```mermaid
graph TD
    subgraph Browser
        Page["Page Component"]
        useQuery["useQuery(api.X.fn)"]
        useMutation["useMutation(api.X.fn)"]
        useAction["useAction(api.X.fn)"]
    end

    subgraph Convex
        Query["query handler"]
        Mutation["mutation handler"]
        Action["action handler"]
        DB[(Database)]
    end

    subgraph External
        R2["Cloudflare R2"]
        AI["OpenRouter API"]
    end

    Page -->|subscribes| useQuery
    useQuery -->|"WebSocket subscription"| Query
    Query -->|reads| DB
    DB -->|"real-time push on change"| Query
    Query -->|"auto re-renders"| useQuery
    useQuery -->|data| Page

    Page -->|user action| useMutation
    useMutation -->|"RPC call"| Mutation
    Mutation -->|reads/writes| DB
    DB -->|"triggers re-run"| Query

    Page -->|side effect| useAction
    useAction -->|"RPC call"| Action
    Action -->|"presigned URLs"| R2
    Action -->|"chat completions"| AI
```

## R2 File Upload Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as r2.ts (clientApi)
    participant R as Cloudflare R2
    participant M as Convex Mutation

    B->>C: generateUploadUrl()
    C->>C: checkUpload → getCurrentUser(ctx)
    C->>R: presigned PUT URL
    C->>B: { url, storageKey }

    B->>R: PUT file (direct upload)
    R->>B: 200 OK

    B->>M: storeFileMetadata(fileName, storageKey, ...)
    M->>M: requireAuth + insert fileMetadata
    M->>B: fileId
```

## AI Chat Flow

```mermaid
sequenceDiagram
    participant B as Browser
    participant M as Convex Mutation
    participant A as Convex Action
    participant O as OpenRouter

    B->>M: saveMessage(role: "user", content)
    M->>M: insert into aiMessages

    B->>A: chat(messages[], systemPrompt?)
    A->>O: POST /api/v1/chat/completions
    O->>A: { choices: [{ message: { content } }] }
    A->>B: { content, model, usage }

    B->>M: saveMessage(role: "assistant", content, model)
    M->>M: insert into aiMessages
```

## User Provisioning Flow

```mermaid
graph TD
    SignIn[User signs in via Clerk] --> Layout["(app)/layout.tsx mounts"]
    Layout --> CheckAuth{isAuthenticated?}
    CheckAuth -->|No| Spinner[Show loading spinner]
    CheckAuth -->|Yes| Provision["getOrCreateUser()"]
    Provision --> Exists{User in DB?}
    Exists -->|Yes| Return[Return existing user]
    Exists -->|No| Insert["Insert new user\n(role: user)"]
    Insert --> Return
    Return --> QueryUser["useQuery(getCurrentUser)"]
    QueryUser --> Ready{user !== null?}
    Ready -->|No| Spinner
    Ready -->|Yes| Render[Render AppShell + children]
```

## Key Patterns

| Pattern | Where | How |
|---------|-------|-----|
| Reactive queries | All pages | `useQuery()` auto-updates when data changes |
| Auth-gated mutations | All writes | `requireAuth(ctx)` before any DB write |
| Owner-only writes | notes, files | Check `record.authorId === user._id` |
| Auto-provisioning | (app)/layout.tsx | `getOrCreateUser()` on mount |
| Skip pattern | (app)/layout.tsx | `useQuery(api.X, isAuthenticated ? {} : "skip")` |
| `"use node"` split | r2Actions, aiActions | Node packages in separate action-only files |
| Presigned URLs | r2.ts (clientApi) | Browser uploads directly to R2, Convex stores metadata |
| External API calls | aiActions.ts | Actions can fetch(), queries/mutations cannot |
