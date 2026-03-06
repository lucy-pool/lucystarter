# Convex Backend Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a comprehensive test suite for all Convex backend functions using `convex-test` + `vitest`, covering auth guards, data boundaries, CRUD operations, and email flows.

**Architecture:** Use `convex-test` to create in-memory Convex instances per test. Seed users directly via `t.run()` to bypass `@convex-dev/auth`'s session table dependency (which `convex-test` doesn't fully support). Test functions via `api.*` and `internal.*` references. Auth guard tests verify that unauthenticated/unauthorized calls throw.

**Tech Stack:** `convex-test`, `vitest`, `@edge-runtime/vm`

---

## Key Constraint: Auth Testing Strategy

Our custom function builders (`userQuery`, `userMutation`, `adminQuery`, `adminMutation`) use `getAuthUserId` from `@convex-dev/auth`, which reads internal auth session tables. `convex-test`'s `withIdentity()` sets `ctx.auth.getUserIdentity()` but does NOT populate the Convex Auth session tables that `getAuthUserId` reads.

**Workaround:** Create a `convex/__tests__/helpers.ts` module that:
1. Uses `t.run()` to insert a user directly into the `users` table
2. Uses `t.withIdentity({ subject: userId })` to link the identity to the seeded user
3. `getAuthUserId` resolves the `subject` field from the identity token to a user ID via the auth tables — if that doesn't work, we fall back to calling internal functions directly

**If `withIdentity` + `getAuthUserId` doesn't work:** Test auth guards by calling internal functions directly (which bypass auth) and test the guard logic in isolation via unit tests on `getCurrentUser`/`requireAdmin`. Track [convex-test#50](https://github.com/get-convex/convex-test/issues/50) for upstream fix.

---

## Task 1: Install Dependencies & Configure Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Install test dependencies**

Run:
```bash
bun add -d convex-test vitest @edge-runtime/vm
```
Expected: packages added to devDependencies

**Step 2: Create vitest config**

Create `vitest.config.ts`:
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
  },
});
```

**Step 3: Add test script to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 4: Verify vitest runs (no tests yet)**

Run: `bun test`
Expected: "No test files found" or similar — confirms vitest is configured

**Step 5: Commit**

```bash
git add package.json vitest.config.ts bun.lockb
git commit -m "chore: add vitest + convex-test for backend testing"
```

---

## Task 2: Create Test Helpers

**Files:**
- Create: `convex/__tests__/helpers.ts`

**Step 1: Create the test helper module**

Create `convex/__tests__/helpers.ts`:
```typescript
import { convexTest } from "convex-test";
import schema from "../schema";
import { modules } from "./setup";
import type { Id } from "../_generated/dataModel";

export { modules };

/**
 * Create a convex test instance with pre-loaded modules.
 */
export function createTest() {
  return convexTest(schema, modules);
}

/**
 * Seed a user directly in the DB and return an authenticated test accessor.
 * This bypasses Convex Auth's session tables since convex-test doesn't support them.
 */
export async function createTestUser(
  t: ReturnType<typeof convexTest>,
  opts: { name?: string; email?: string; roles?: ("user" | "admin")[] } = {}
) {
  const name = opts.name ?? "Test User";
  const email = opts.email ?? `${name.toLowerCase().replace(/\s/g, ".")}@test.com`;
  const roles = opts.roles ?? ["user"];

  const userId = await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      name,
      email,
      roles,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  });

  // withIdentity sets ctx.auth.getUserIdentity() — getAuthUserId reads the
  // subject field to resolve the user ID. We pass the raw userId as subject.
  const asUser = t.withIdentity({
    name,
    email,
    subject: userId,
    tokenIdentifier: `test|${userId}`,
  });

  return { userId: userId as Id<"users">, asUser, name, email };
}

/**
 * Create an admin user.
 */
export async function createAdminUser(
  t: ReturnType<typeof convexTest>,
  opts: { name?: string; email?: string } = {}
) {
  return createTestUser(t, { ...opts, roles: ["admin"] });
}
```

**Step 2: Create the modules setup file**

Create `convex/__tests__/setup.ts`:
```typescript
// Import all convex modules for convex-test.
// convex-test needs this to resolve function references in subdirectories.
export const modules = import.meta.glob({
  "../**/*.ts": { eager: true },
  "../**/*.tsx": { eager: true },
});
```

**Step 3: Commit**

```bash
git add convex/__tests__/
git commit -m "test: add convex-test helpers for user seeding and auth"
```

---

## Task 3: Auth Guard Tests

**Files:**
- Create: `convex/__tests__/auth.test.ts`

This is the most critical test — verifies that our 3-layer security model works at the backend layer.

**Step 1: Write the auth guard tests**

Create `convex/__tests__/auth.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import { createTest, createTestUser, createAdminUser } from "./helpers";

describe("auth guards", () => {
  describe("userQuery/userMutation — reject unauthenticated", () => {
    test("notes.list rejects unauthenticated call", async () => {
      const t = createTest();

      await expect(
        t.query(api.notes.list)
      ).rejects.toThrow(/[Aa]uthentication/);
    });

    test("notes.create rejects unauthenticated call", async () => {
      const t = createTest();

      await expect(
        t.mutation(api.notes.create, {
          title: "test",
          body: "test",
          isPublic: false,
        })
      ).rejects.toThrow(/[Aa]uthentication/);
    });
  });

  describe("userQuery/userMutation — allow authenticated", () => {
    test("notes.list succeeds for authenticated user", async () => {
      const t = createTest();
      const { asUser } = await createTestUser(t);

      const result = await asUser.query(api.notes.list);
      expect(result).toEqual([]);
    });

    test("notes.create succeeds for authenticated user", async () => {
      const t = createTest();
      const { asUser } = await createTestUser(t);

      const id = await asUser.mutation(api.notes.create, {
        title: "My Note",
        body: "Content",
        isPublic: false,
      });
      expect(id).toBeTruthy();
    });
  });

  describe("adminQuery/adminMutation — reject non-admin", () => {
    test("users.getAllUsers rejects non-admin user", async () => {
      const t = createTest();
      const { asUser } = await createTestUser(t, { roles: ["user"] });

      await expect(
        asUser.query(api.users.getAllUsers)
      ).rejects.toThrow(/[Aa]dmin/);
    });

    test("users.updateUserRoles rejects non-admin user", async () => {
      const t = createTest();
      const { asUser, userId } = await createTestUser(t);

      await expect(
        asUser.mutation(api.users.updateUserRoles, {
          userId,
          roles: ["admin"],
        })
      ).rejects.toThrow(/[Aa]dmin/);
    });
  });

  describe("adminQuery/adminMutation — allow admin", () => {
    test("users.getAllUsers succeeds for admin", async () => {
      const t = createTest();
      const { asUser } = await createAdminUser(t);

      const users = await asUser.query(api.users.getAllUsers);
      expect(users.length).toBeGreaterThanOrEqual(1);
    });

    test("users.updateUserRoles succeeds for admin", async () => {
      const t = createTest();
      const { asUser: asAdmin } = await createAdminUser(t);
      const { userId: targetId } = await createTestUser(t, { name: "Target" });

      await asAdmin.mutation(api.users.updateUserRoles, {
        userId: targetId,
        roles: ["admin"],
      });

      // Verify role was updated
      const users = await asAdmin.query(api.users.getAllUsers);
      const target = users.find((u) => u._id === targetId);
      expect(target?.roles).toContain("admin");
    });
  });
});
```

**Step 2: Run tests to verify they pass (or identify auth workaround needed)**

Run: `bun test convex/__tests__/auth.test.ts`

If tests fail with `getUserIdentity` errors, we need to adjust the helper. See "Key Constraint" section above. The fallback is to test internal functions directly:

```typescript
// Fallback: test internal functions that bypass custom builders
import { internal } from "../_generated/api";

test("createEmailLog works via internal API", async () => {
  const t = createTest();
  const logId = await t.mutation(internal.email.logs.createEmailLog, {
    to: "test@example.com",
    template: "welcome",
    templateData: JSON.stringify({ name: "Test" }),
  });
  expect(logId).toBeTruthy();
});
```

**Step 3: Commit**

```bash
git add convex/__tests__/auth.test.ts
git commit -m "test: add auth guard tests for userQuery/adminQuery"
```

---

## Task 4: Notes CRUD + Data Boundary Tests

**Files:**
- Create: `convex/__tests__/notes.test.ts`

**Step 1: Write the notes test file**

Create `convex/__tests__/notes.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import { createTest, createTestUser } from "./helpers";

describe("notes CRUD", () => {
  test("create and list a note", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const noteId = await asUser.mutation(api.notes.create, {
      title: "Test Note",
      body: "Hello world",
      isPublic: false,
    });

    const notes = await asUser.query(api.notes.list);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      _id: noteId,
      title: "Test Note",
      body: "Hello world",
      isPublic: false,
    });
  });

  test("update a note", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const noteId = await asUser.mutation(api.notes.create, {
      title: "Original",
      body: "Original body",
      isPublic: false,
    });

    await asUser.mutation(api.notes.update, {
      id: noteId,
      title: "Updated",
    });

    const notes = await asUser.query(api.notes.list);
    expect(notes[0].title).toBe("Updated");
    expect(notes[0].body).toBe("Original body"); // unchanged field
  });

  test("delete a note", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const noteId = await asUser.mutation(api.notes.create, {
      title: "To Delete",
      body: "Bye",
      isPublic: false,
    });

    await asUser.mutation(api.notes.remove, { id: noteId });

    const notes = await asUser.query(api.notes.list);
    expect(notes).toHaveLength(0);
  });

  describe("data boundaries", () => {
    test("user cannot see another user's private notes", async () => {
      const t = createTest();
      const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
      const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

      await asAlice.mutation(api.notes.create, {
        title: "Alice's Secret",
        body: "Private",
        isPublic: false,
      });

      const bobsNotes = await asBob.query(api.notes.list);
      expect(bobsNotes).toHaveLength(0);
    });

    test("user can see another user's public notes", async () => {
      const t = createTest();
      const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
      const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

      await asAlice.mutation(api.notes.create, {
        title: "Alice's Public Note",
        body: "Visible to all",
        isPublic: true,
      });

      const bobsNotes = await asBob.query(api.notes.list);
      expect(bobsNotes).toHaveLength(1);
      expect(bobsNotes[0].title).toBe("Alice's Public Note");
    });

    test("user cannot update another user's note", async () => {
      const t = createTest();
      const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
      const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

      const noteId = await asAlice.mutation(api.notes.create, {
        title: "Alice's Note",
        body: "Content",
        isPublic: true,
      });

      await expect(
        asBob.mutation(api.notes.update, { id: noteId, title: "Hacked" })
      ).rejects.toThrow(/not found|access denied/i);
    });

    test("user cannot delete another user's note", async () => {
      const t = createTest();
      const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
      const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

      const noteId = await asAlice.mutation(api.notes.create, {
        title: "Alice's Note",
        body: "Content",
        isPublic: false,
      });

      await expect(
        asBob.mutation(api.notes.remove, { id: noteId })
      ).rejects.toThrow(/not found|access denied/i);
    });
  });
});
```

**Step 2: Run tests**

Run: `bun test convex/__tests__/notes.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add convex/__tests__/notes.test.ts
git commit -m "test: add notes CRUD and data boundary tests"
```

---

## Task 5: Users Service Tests

**Files:**
- Create: `convex/__tests__/users.test.ts`

**Step 1: Write the users test file**

Create `convex/__tests__/users.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api } from "../_generated/api";
import { createTest, createTestUser, createAdminUser } from "./helpers";

describe("users", () => {
  test("getCurrentUser returns null when unauthenticated", async () => {
    const t = createTest();
    const result = await t.query(api.users.getCurrentUser);
    expect(result).toBeNull();
  });

  test("getCurrentUser returns user when authenticated", async () => {
    const t = createTest();
    const { asUser, name, email } = await createTestUser(t);

    const user = await asUser.query(api.users.getCurrentUser);
    expect(user).toMatchObject({ name, email });
  });

  test("updateProfile updates name", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t, { name: "Original" });

    await asUser.mutation(api.users.updateProfile, { name: "Updated" });

    const user = await asUser.query(api.users.getCurrentUser);
    expect(user?.name).toBe("Updated");
  });

  describe("admin operations", () => {
    test("getAllUsers lists all users", async () => {
      const t = createTest();
      const { asUser: asAdmin } = await createAdminUser(t, { name: "Admin" });
      await createTestUser(t, { name: "User1" });
      await createTestUser(t, { name: "User2" });

      const users = await asAdmin.query(api.users.getAllUsers);
      expect(users.length).toBe(3); // admin + 2 users
    });

    test("adminUpdateUser updates another user's name", async () => {
      const t = createTest();
      const { asUser: asAdmin } = await createAdminUser(t);
      const { userId: targetId } = await createTestUser(t, { name: "Target" });

      await asAdmin.mutation(api.users.adminUpdateUser, {
        userId: targetId,
        name: "New Name",
      });

      const users = await asAdmin.query(api.users.getAllUsers);
      const target = users.find((u) => u._id === targetId);
      expect(target?.name).toBe("New Name");
    });
  });
});
```

**Step 2: Run tests**

Run: `bun test convex/__tests__/users.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add convex/__tests__/users.test.ts
git commit -m "test: add users service tests"
```

---

## Task 6: AI Messages Tests

**Files:**
- Create: `convex/ai/__tests__/messages.test.ts`

**Step 1: Write the AI messages test file**

Create `convex/ai/__tests__/messages.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api } from "../../_generated/api";
import { createTest, createTestUser } from "../../__tests__/helpers";

describe("ai messages", () => {
  test("save and list messages", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    await asUser.mutation(api.ai.messages.saveMessage, {
      role: "user",
      content: "Hello AI",
    });
    await asUser.mutation(api.ai.messages.saveMessage, {
      role: "assistant",
      content: "Hello human",
      model: "test-model",
    });

    const messages = await asUser.query(api.ai.messages.listMessages);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: "user", content: "Hello AI" });
    expect(messages[1]).toMatchObject({
      role: "assistant",
      content: "Hello human",
      model: "test-model",
    });
  });

  test("clearHistory removes all user messages", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    await asUser.mutation(api.ai.messages.saveMessage, {
      role: "user",
      content: "Message 1",
    });
    await asUser.mutation(api.ai.messages.saveMessage, {
      role: "assistant",
      content: "Response 1",
    });

    await asUser.mutation(api.ai.messages.clearHistory);

    const messages = await asUser.query(api.ai.messages.listMessages);
    expect(messages).toHaveLength(0);
  });

  test("users cannot see each other's messages", async () => {
    const t = createTest();
    const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
    const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

    await asAlice.mutation(api.ai.messages.saveMessage, {
      role: "user",
      content: "Alice's message",
    });

    const bobMessages = await asBob.query(api.ai.messages.listMessages);
    expect(bobMessages).toHaveLength(0);
  });

  test("clearHistory only clears own messages", async () => {
    const t = createTest();
    const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
    const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

    await asAlice.mutation(api.ai.messages.saveMessage, {
      role: "user",
      content: "Alice's message",
    });
    await asBob.mutation(api.ai.messages.saveMessage, {
      role: "user",
      content: "Bob's message",
    });

    await asAlice.mutation(api.ai.messages.clearHistory);

    const aliceMessages = await asAlice.query(api.ai.messages.listMessages);
    const bobMessages = await asBob.query(api.ai.messages.listMessages);
    expect(aliceMessages).toHaveLength(0);
    expect(bobMessages).toHaveLength(1);
  });
});
```

**Step 2: Run tests**

Run: `bun test convex/ai/__tests__/messages.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add convex/ai/__tests__/messages.test.ts
git commit -m "test: add AI messages CRUD and data boundary tests"
```

---

## Task 7: Storage/Files Tests

**Files:**
- Create: `convex/storage/__tests__/files.test.ts`

Note: We can't test actual R2 upload/download in unit tests (requires real R2). We test the metadata CRUD and ownership checks only.

**Step 1: Write the files test**

Create `convex/storage/__tests__/files.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api } from "../../_generated/api";
import { createTest, createTestUser } from "../../__tests__/helpers";

describe("file metadata", () => {
  test("store and list file metadata", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const fileId = await asUser.mutation(api.storage.files.storeFileMetadata, {
      fileName: "test.pdf",
      storageKey: "uploads/test-key-123",
      mimeType: "application/pdf",
      size: 1024,
      fileType: "document",
    });

    const files = await asUser.query(api.storage.files.getMyFiles);
    expect(files).toHaveLength(1);
    expect(files[0]).toMatchObject({
      _id: fileId,
      fileName: "test.pdf",
      storageKey: "uploads/test-key-123",
      mimeType: "application/pdf",
      size: 1024,
      fileType: "document",
    });
  });

  test("users only see their own files", async () => {
    const t = createTest();
    const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
    const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

    await asAlice.mutation(api.storage.files.storeFileMetadata, {
      fileName: "alice.pdf",
      storageKey: "uploads/alice-key",
      mimeType: "application/pdf",
      size: 512,
      fileType: "document",
    });

    const bobFiles = await asBob.query(api.storage.files.getMyFiles);
    expect(bobFiles).toHaveLength(0);
  });

  // Note: deleteFile calls r2.deleteObject which may not work in convex-test.
  // If this test fails due to R2 component not being available, skip it
  // and add a comment to test manually.
  test.skip("user cannot delete another user's file", async () => {
    const t = createTest();
    const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
    const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

    const fileId = await asAlice.mutation(api.storage.files.storeFileMetadata, {
      fileName: "alice.pdf",
      storageKey: "uploads/alice-key",
      mimeType: "application/pdf",
      size: 512,
      fileType: "document",
    });

    await expect(
      asBob.mutation(api.storage.files.deleteFile, { fileId })
    ).rejects.toThrow(/not authorized/i);
  });
});
```

**Step 2: Run tests**

Run: `bun test convex/storage/__tests__/files.test.ts`
Expected: PASS (skipped test noted)

**Step 3: Commit**

```bash
git add convex/storage/__tests__/files.test.ts
git commit -m "test: add file metadata CRUD and ownership tests"
```

---

## Task 8: Email Service Tests

**Files:**
- Create: `convex/email/__tests__/logs.test.ts`
- Create: `convex/email/__tests__/templates.test.ts`

Note: We test internal functions directly since email send/log creation are system-triggered. Actions (processEmail, getEmailConfig) require Node.js + external APIs — skip those in unit tests.

**Step 1: Write email log tests**

Create `convex/email/__tests__/logs.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { internal } from "../../_generated/api";
import { createTest, createAdminUser, createTestUser } from "../../__tests__/helpers";

describe("email logs", () => {
  test("createEmailLog creates a queued log", async () => {
    const t = createTest();

    const logId = await t.mutation(internal.email.logs.createEmailLog, {
      to: "user@test.com",
      template: "welcome",
      templateData: JSON.stringify({ name: "Test User", loginUrl: "/dashboard" }),
    });

    expect(logId).toBeTruthy();

    const log = await t.query(internal.email.logs.getEmailLogInternal, { logId });
    expect(log).toMatchObject({
      to: "user@test.com",
      template: "welcome",
      status: "queued",
      subject: "", // set by action after rendering
    });
  });

  test("updateEmailLog patches status and subject", async () => {
    const t = createTest();

    const logId = await t.mutation(internal.email.logs.createEmailLog, {
      to: "user@test.com",
      template: "welcome",
      templateData: "{}",
    });

    await t.mutation(internal.email.logs.updateEmailLog, {
      logId,
      status: "sent",
      subject: "Welcome!",
      provider: "resend",
      providerMessageId: "msg-123",
      sentAt: Date.now(),
    });

    const log = await t.query(internal.email.logs.getEmailLogInternal, { logId });
    expect(log?.status).toBe("sent");
    expect(log?.subject).toBe("Welcome!");
    expect(log?.provider).toBe("resend");
  });

  test("updateEmailLog records failure", async () => {
    const t = createTest();

    const logId = await t.mutation(internal.email.logs.createEmailLog, {
      to: "bad@test.com",
      template: "notification",
      templateData: "{}",
    });

    await t.mutation(internal.email.logs.updateEmailLog, {
      logId,
      status: "failed",
      error: "SMTP connection refused",
    });

    const log = await t.query(internal.email.logs.getEmailLogInternal, { logId });
    expect(log?.status).toBe("failed");
    expect(log?.error).toBe("SMTP connection refused");
  });

  test("listEmailLogs returns logs for admin", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    // Seed some logs via internal API
    await t.mutation(internal.email.logs.createEmailLog, {
      to: "a@test.com",
      template: "welcome",
      templateData: "{}",
    });
    await t.mutation(internal.email.logs.createEmailLog, {
      to: "b@test.com",
      template: "notification",
      templateData: "{}",
    });

    const logs = await asAdmin.query(api.email.logs.listEmailLogs);
    expect(logs.length).toBe(2);
  });

  test("listEmailLogs rejects non-admin", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    await expect(
      asUser.query(api.email.logs.listEmailLogs)
    ).rejects.toThrow(/[Aa]dmin/);
  });
});
```

Note: Add this import at the top if `api` is used:
```typescript
import { api } from "../../_generated/api";
```

**Step 2: Write email template tests**

Create `convex/email/__tests__/templates.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api, internal } from "../../_generated/api";
import { createTest, createAdminUser, createTestUser } from "../../__tests__/helpers";

describe("email templates", () => {
  const baseTemplate = {
    name: "test-template",
    label: "Test Template",
    subject: "Hello {{name}}",
    editorMode: "html" as const,
    contentJson: "{}",
    contentHtml: "<p>Hello {{name}}</p>",
    variables: [{ name: "name", required: true, defaultValue: "World" }],
  };

  test("admin can create a template", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const id = await asAdmin.mutation(api.email.templates.create, baseTemplate);
    expect(id).toBeTruthy();

    const templates = await asAdmin.query(api.email.templates.list);
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({
      name: "test-template",
      label: "Test Template",
    });
  });

  test("non-admin cannot create a template", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    await expect(
      asUser.mutation(api.email.templates.create, baseTemplate)
    ).rejects.toThrow(/[Aa]dmin/);
  });

  test("duplicate template name is rejected", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    await asAdmin.mutation(api.email.templates.create, baseTemplate);

    await expect(
      asAdmin.mutation(api.email.templates.create, baseTemplate)
    ).rejects.toThrow(/already exists/);
  });

  test("update a template", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const templateId = await asAdmin.mutation(
      api.email.templates.create,
      baseTemplate
    );

    await asAdmin.mutation(api.email.templates.update, {
      templateId,
      subject: "Updated: {{name}}",
    });

    const template = await asAdmin.query(api.email.templates.get, {
      templateId,
    });
    expect(template?.subject).toBe("Updated: {{name}}");
    expect(template?.label).toBe("Test Template"); // unchanged
  });

  test("duplicate template", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const templateId = await asAdmin.mutation(
      api.email.templates.create,
      baseTemplate
    );

    const copyId = await asAdmin.mutation(api.email.templates.duplicate, {
      templateId,
    });

    const copy = await asAdmin.query(api.email.templates.get, {
      templateId: copyId,
    });
    expect(copy?.name).toBe("test-template-copy");
    expect(copy?.label).toBe("Test Template (Copy)");
  });

  test("delete a template", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const templateId = await asAdmin.mutation(
      api.email.templates.create,
      baseTemplate
    );

    await asAdmin.mutation(api.email.templates.remove, { templateId });

    const templates = await asAdmin.query(api.email.templates.list);
    expect(templates).toHaveLength(0);
  });

  test("cannot delete template with queued emails", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const templateId = await asAdmin.mutation(
      api.email.templates.create,
      baseTemplate
    );

    // Create a queued email referencing this template
    await t.mutation(internal.email.logs.createEmailLog, {
      to: "test@test.com",
      template: "custom",
      templateData: "{}",
      customTemplateId: templateId,
    });

    await expect(
      asAdmin.mutation(api.email.templates.remove, { templateId })
    ).rejects.toThrow(/queued emails/i);
  });

  test("getInternal returns template for actions", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    const templateId = await asAdmin.mutation(
      api.email.templates.create,
      baseTemplate
    );

    const template = await t.query(internal.email.templates.getInternal, {
      templateId,
    });
    expect(template?.name).toBe("test-template");
  });
});
```

**Step 3: Run all email tests**

Run: `bun test convex/email/__tests__/`
Expected: All PASS

**Step 4: Commit**

```bash
git add convex/email/__tests__/
git commit -m "test: add email logs and template CRUD tests"
```

---

## Task 9: Email Send Flow Tests

**Files:**
- Create: `convex/email/__tests__/send.test.ts`

Tests `sendEmail` and `resendEmail` mutations (which create logs and schedule actions).

**Step 1: Write send flow tests**

Create `convex/email/__tests__/send.test.ts`:
```typescript
import { expect, test, describe } from "vitest";
import { api, internal } from "../../_generated/api";
import { createTest, createTestUser, createAdminUser } from "../../__tests__/helpers";

describe("email send flow", () => {
  test("sendEmail creates a queued log", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const logId = await asUser.mutation(api.email.send.sendEmail, {
      to: "recipient@test.com",
      template: "welcome",
      templateData: JSON.stringify({ name: "Recipient", loginUrl: "/dashboard" }),
    });

    expect(logId).toBeTruthy();

    // Verify log was created
    const log = await t.query(internal.email.logs.getEmailLogInternal, { logId });
    expect(log).toMatchObject({
      to: "recipient@test.com",
      template: "welcome",
      status: "queued",
    });
  });

  test("sendEmail with custom template", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    // Create a custom template first
    const templateId = await asAdmin.mutation(api.email.templates.create, {
      name: "newsletter",
      label: "Newsletter",
      subject: "News for {{name}}",
      editorMode: "html",
      contentJson: "{}",
      contentHtml: "<p>Hello {{name}}</p>",
      variables: [{ name: "name", required: true }],
    });

    const logId = await asAdmin.mutation(api.email.send.sendEmail, {
      to: "subscriber@test.com",
      template: "custom",
      templateData: JSON.stringify({ name: "Subscriber" }),
      customTemplateId: templateId,
    });

    const log = await t.query(internal.email.logs.getEmailLogInternal, { logId });
    expect(log?.template).toBe("custom");
    expect(log?.customTemplateId).toBe(templateId);
  });

  test("resendEmail creates a new log from old one (admin only)", async () => {
    const t = createTest();
    const { asUser: asAdmin } = await createAdminUser(t);

    // Create original email log
    const originalLogId = await t.mutation(internal.email.logs.createEmailLog, {
      to: "failed@test.com",
      template: "notification",
      templateData: JSON.stringify({ name: "User", title: "Alert", body: "Something happened" }),
    });

    // Mark it as failed
    await t.mutation(internal.email.logs.updateEmailLog, {
      logId: originalLogId,
      status: "failed",
      error: "SMTP timeout",
    });

    // Resend
    const newLogId = await asAdmin.mutation(api.email.send.resendEmail, {
      logId: originalLogId,
    });

    expect(newLogId).not.toBe(originalLogId);

    const newLog = await t.query(internal.email.logs.getEmailLogInternal, { logId: newLogId });
    expect(newLog?.to).toBe("failed@test.com");
    expect(newLog?.template).toBe("notification");
    expect(newLog?.status).toBe("queued"); // re-queued
  });

  test("resendEmail rejects non-admin", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const logId = await t.mutation(internal.email.logs.createEmailLog, {
      to: "test@test.com",
      template: "welcome",
      templateData: "{}",
    });

    await expect(
      asUser.mutation(api.email.send.resendEmail, { logId })
    ).rejects.toThrow(/[Aa]dmin/);
  });
});
```

**Step 2: Run tests**

Run: `bun test convex/email/__tests__/send.test.ts`
Expected: All PASS

**Step 3: Commit**

```bash
git add convex/email/__tests__/send.test.ts
git commit -m "test: add email send flow tests"
```

---

## Task 10: Run Full Suite & Add to Stop Hook

**Step 1: Run the full test suite**

Run: `bun test`
Expected: All tests pass

**Step 2: Add test step to stop-hook**

Modify `.claude/hooks/stop-hook.ts` — add test run as check 0, before TypeScript typecheck. In the `main()` function, after the `changedFiles` check:

```typescript
  // --- Check 0: Run tests ---
  console.error("Running tests...");
  const testResult = await runCommand("bun", ["test"], input.cwd);
  if (testResult.code !== 0) {
    block(`Tests failed. Please fix them:\n${testResult.output}`);
    return;
  }
```

**Step 3: Verify stop hook runs tests**

Make a trivial edit to any convex file, then verify the stop hook runs tests before typecheck.

**Step 4: Commit**

```bash
git add .claude/hooks/stop-hook.ts
git commit -m "ci: add test run to stop hook"
```

---

## Summary: Test Coverage

| Service | File | Tests | Coverage |
|---------|------|-------|----------|
| Auth | `convex/__tests__/auth.test.ts` | 6 | Guard rejection + acceptance for user/admin |
| Users | `convex/__tests__/users.test.ts` | 5 | getCurrentUser, updateProfile, admin ops |
| Notes | `convex/__tests__/notes.test.ts` | 7 | CRUD + data boundaries (private/public/ownership) |
| AI Messages | `convex/ai/__tests__/messages.test.ts` | 4 | CRUD + isolation + clear own only |
| Storage | `convex/storage/__tests__/files.test.ts` | 2+1 | Metadata CRUD + ownership (delete skipped — R2) |
| Email Logs | `convex/email/__tests__/logs.test.ts` | 5 | Internal CRUD + admin list + rejection |
| Email Templates | `convex/email/__tests__/templates.test.ts` | 7 | Admin CRUD + unique name + delete blocked + duplicate |
| Email Send | `convex/email/__tests__/send.test.ts` | 4 | Send flow + custom template + resend + auth |

**Total: ~40 tests**

## Known Limitations

1. **`getAuthUserId` compatibility** — If `convex-test` v0.0.41 doesn't support the `getUserIdentity` syscall needed by `@convex-dev/auth`, auth-gated tests (Tasks 3-9) will need the fallback approach: test internal functions directly and test guards in isolation. Track [convex-test#50](https://github.com/get-convex/convex-test/issues/50).

2. **R2 component** — `deleteFile` calls `r2.deleteObject` which requires the R2 component to be initialized. Marked as `test.skip` in Task 7.

3. **Actions** — `processEmail`, `getEmailConfig`, `chat`, `generateDownloadUrl` are Node.js actions calling external APIs. Not unit-testable. Test via integration/E2E instead.

4. **Scheduled functions** — `sendEmail` schedules `processEmail` via `scheduler.runAfter(0, ...)`. The schedule happens but the action won't execute in tests without `t.finishInProgressScheduledFunctions()`. Tests verify the log was created, not that the email was sent.
