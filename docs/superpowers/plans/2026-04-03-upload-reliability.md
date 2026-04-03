# Upload Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two-phase upload tracking (pending → complete) with cron cleanup for orphaned uploads.

**Architecture:** Add `status` and `updatedAt` fields to the existing `fileMetadata` table. New `createPendingFile` and `confirmUpload` mutations bracket the R2 upload. A cron job cleans up stale pending records every 30 minutes. The existing `@convex-dev/r2` integration stays unchanged.

**Tech Stack:** Convex (schema, mutations, actions, crons), `@convex-dev/r2`, TanStack Start (React)

**Spec:** `docs/superpowers/specs/2026-04-03-upload-reliability-design.md`

---

### Task 1: Add Status Fields to Schema

**Files:**
- Modify: `convex/schema.ts:60-72`

- [ ] **Step 1: Add fileUploadStatusValidator and new fields to fileMetadata table**

In `convex/schema.ts`, add the status validator after the existing `fileTypeValidator` (after line 17):

```ts
// ── File upload status ─────────────────────────────────────────────
export const fileUploadStatusValidator = v.union(
  v.literal("pending"),
  v.literal("complete")
);
```

Then update the `fileMetadata` table definition to add the new fields and index. Replace lines 62-72:

```ts
  fileMetadata: defineTable({
    fileName: v.string(),
    storageKey: v.optional(v.string()),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
    status: v.optional(fileUploadStatusValidator),
    createdBy: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_file_type", ["fileType"])
    .index("by_status", ["status"]),
```

Changes:
- `storageKey` becomes `v.optional(v.string())` — pending records don't have one yet
- `status` added as `v.optional(fileUploadStatusValidator)` — backwards-compatible
- `updatedAt` added as `v.optional(v.number())`
- `by_status` index added for cron queries

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: May show errors in `convex/storage/files.ts` because the `fileMetadataValidator` in that file references the old shape. These are fixed in Task 2.

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add status and updatedAt fields to fileMetadata schema"
```

---

### Task 2: Add createPendingFile and confirmUpload Mutations + Modify getMyFiles

**Files:**
- Modify: `convex/storage/files.ts`
- Test: `tests/convex/storage/files.test.ts`

- [ ] **Step 1: Write tests for pending/complete lifecycle**

Add these tests to the end of the `describe("Storage files", ...)` block in `tests/convex/storage/files.test.ts`:

```ts
  it("pending files are not visible in getMyFiles", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    await asUser.mutation(api.storage.files.createPendingFile, {
      fileName: "uploading.png",
      mimeType: "image/png",
      size: 5000,
      fileType: "image",
    });

    const files = await asUser.query(api.storage.files.getMyFiles, {});
    expect(files).toHaveLength(0);
  });

  it("confirmed files are visible in getMyFiles", async () => {
    const t = createTest();
    const { asUser } = await createTestUser(t);

    const fileId = await asUser.mutation(api.storage.files.createPendingFile, {
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      size: 8000,
      fileType: "image",
    });

    await asUser.mutation(api.storage.files.confirmUpload, {
      fileId,
      storageKey: "uploads/photo.jpg",
    });

    const files = await asUser.query(api.storage.files.getMyFiles, {});
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("photo.jpg");
    expect(files[0].storageKey).toBe("uploads/photo.jpg");
    expect(files[0].status).toBe("complete");
  });

  it("only file owner can confirm upload", async () => {
    const t = createTest();
    const { asUser: asAlice } = await createTestUser(t, { name: "Alice" });
    const { asUser: asBob } = await createTestUser(t, { name: "Bob" });

    const fileId = await asAlice.mutation(api.storage.files.createPendingFile, {
      fileName: "alice-file.png",
      mimeType: "image/png",
      size: 1000,
      fileType: "image",
    });

    await expect(
      asBob.mutation(api.storage.files.confirmUpload, {
        fileId,
        storageKey: "uploads/alice-file.png",
      })
    ).rejects.toThrow(/not authorized/i);
  });

  it("existing records without status still appear in getMyFiles", async () => {
    const t = createTest();
    const { asUser, userId } = await createTestUser(t);

    // Insert a legacy record directly (no status field)
    await t.run(async (ctx) => {
      await ctx.db.insert("fileMetadata", {
        fileName: "legacy.pdf",
        storageKey: "uploads/legacy.pdf",
        mimeType: "application/pdf",
        size: 2000,
        fileType: "document",
        createdBy: userId,
        createdAt: Date.now(),
      });
    });

    const files = await asUser.query(api.storage.files.getMyFiles, {});
    expect(files).toHaveLength(1);
    expect(files[0].fileName).toBe("legacy.pdf");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- tests/convex/storage/files.test.ts`

Expected: FAIL — `createPendingFile` and `confirmUpload` don't exist yet.

- [ ] **Step 3: Implement createPendingFile, confirmUpload, and modify getMyFiles**

Replace the entire contents of `convex/storage/files.ts` with:

```ts
import { v } from "convex/values";
import { fileTypeValidator, fileUploadStatusValidator } from "../schema";
import { r2 } from "./r2";
import { userQuery, userMutation } from "../functions";
import { internalMutation } from "../_generated/server";

// ── File metadata CRUD ──────────────────────────────────────────────
// Upload flow: createPendingFile → PUT to R2 → confirmUpload.
// Cron cleans up stale pending records via cleanupOrphanedRecords.

/** Create a pending file record before upload starts. */
export const createPendingFile = userMutation({
  args: {
    fileName: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
  },
  returns: v.id("fileMetadata"),
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("fileMetadata", {
      fileName: args.fileName,
      mimeType: args.mimeType,
      size: args.size,
      fileType: args.fileType,
      status: "pending",
      createdBy: ctx.user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Confirm upload: attach storageKey and flip pending → complete. */
export const confirmUpload = userMutation({
  args: {
    fileId: v.id("fileMetadata"),
    storageKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.createdBy !== ctx.user._id) {
      throw new Error("Not authorized to confirm this upload");
    }
    if (file.status !== "pending") {
      throw new Error("File is not in pending status");
    }
    await ctx.db.patch(args.fileId, {
      storageKey: args.storageKey,
      status: "complete",
      updatedAt: Date.now(),
    });
  },
});

/** Save file metadata after successful R2 upload (legacy flow). */
export const storeFileMetadata = userMutation({
  args: {
    fileName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
  },
  returns: v.id("fileMetadata"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("fileMetadata", {
      fileName: args.fileName,
      storageKey: args.storageKey,
      mimeType: args.mimeType,
      size: args.size,
      fileType: args.fileType,
      status: "complete",
      createdBy: ctx.user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/** List the current user's completed files. */
export const getMyFiles = userQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("fileMetadata"),
      _creationTime: v.number(),
      fileName: v.string(),
      storageKey: v.optional(v.string()),
      mimeType: v.string(),
      size: v.number(),
      fileType: fileTypeValidator,
      status: v.optional(fileUploadStatusValidator),
      createdBy: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const files = await ctx.db
      .query("fileMetadata")
      .withIndex("by_created_by", (q) => q.eq("createdBy", ctx.user._id))
      .collect();
    // Show completed files + legacy records (no status field)
    return files.filter((f) => f.status !== "pending");
  },
});

/** Delete file metadata and the R2 object (author only). */
export const deleteFile = userMutation({
  args: {
    fileId: v.id("fileMetadata"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    if (file.createdBy !== ctx.user._id) {
      throw new Error("Not authorized to delete this file");
    }
    if (file.storageKey) {
      await r2.deleteObject(ctx, file.storageKey);
    }
    await ctx.db.delete(args.fileId);
  },
});

// ── Internal: orphan cleanup ────────────────────────────────────────

const PENDING_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

/** Delete expired pending records from the DB. Returns storageKeys for R2 cleanup. */
export const cleanupOrphanedRecords = internalMutation({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx) => {
    const cutoff = Date.now() - PENDING_EXPIRY_MS;
    const pendingFiles = await ctx.db
      .query("fileMetadata")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    const expiredKeys: string[] = [];
    for (const file of pendingFiles) {
      if (file.createdAt < cutoff) {
        if (file.storageKey) {
          expiredKeys.push(file.storageKey);
        }
        await ctx.db.delete(file._id);
      }
    }
    return expiredKeys;
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- tests/convex/storage/files.test.ts`

Expected: All tests pass (existing + 4 new).

- [ ] **Step 5: Run typecheck**

Run: `bun run typecheck`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/storage/files.ts tests/convex/storage/files.test.ts
git commit -m "feat: add pending/complete upload lifecycle with tests"
```

---

### Task 3: Add Cron Cleanup

**Files:**
- Create: `convex/crons.ts`

- [ ] **Step 1: Create the crons file**

Create `convex/crons.ts`:

```ts
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Clean up file uploads stuck in "pending" status for over 30 minutes.
// These are uploads that were started but never completed (tab closed, network drop, etc.).
crons.interval(
  "cleanup orphaned uploads",
  { minutes: 30 },
  internal.storage.files.cleanupOrphanedRecords,
);

export default crons;
```

Note: The `cleanupOrphanedRecords` internal mutation deletes the DB records and returns storageKeys of orphaned R2 objects. A future enhancement could add an internal action to delete those R2 objects, but since pending records typically don't have a storageKey (the upload never completed), this handles the common case.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `bun run test`

Expected: All pass (crons don't affect test execution).

- [ ] **Step 4: Commit**

```bash
git add convex/crons.ts
git commit -m "feat: add cron job to clean up orphaned pending uploads"
```

---

### Task 4: Update Frontend Upload Flow

**Files:**
- Modify: `src/routes/_app/files.tsx`

- [ ] **Step 1: Update handleUpload to three-step flow**

Replace the entire contents of `src/routes/_app/files.tsx` with:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { useUploadFile } from "@convex-dev/r2/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Upload, Download, FileIcon } from "lucide-react";
import { formatBytes, getFileType } from "@/lib/utils";

// ── Demo page — shows the R2 upload pattern ──────────────────────────
// Flow: createPendingFile → PUT to R2 → confirmUpload

export const Route = createFileRoute("/_app/files")({
  component: FilesPage,
});

function FilesPage() {
  const files = useQuery(api.storage.files.getMyFiles);
  const uploadFile = useUploadFile(api.storage.r2);
  const generateDownloadUrl = useAction(api.storage.downloads.generateDownloadUrl);
  const createPendingFile = useMutation(api.storage.files.createPendingFile);
  const confirmUpload = useMutation(api.storage.files.confirmUpload);
  const deleteFileMutation = useMutation(api.storage.files.deleteFile);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);

    try {
      // 1. Create pending record in DB
      const fileId = await createPendingFile({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        fileType: getFileType(file.type),
      });

      // 2. Upload to R2 (returns storageKey)
      const storageKey = await uploadFile(file, {
        onProgress: ({ loaded, total }) => {
          setProgress(Math.round((loaded / total) * 100));
        },
      });

      // 3. Confirm upload (attach storageKey, flip pending → complete)
      await confirmUpload({ fileId, storageKey });
    } catch (err) {
      console.error("Upload failed:", err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }, [uploadFile, createPendingFile, confirmUpload]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) handleUpload(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
  }

  async function handleDownload(storageKey: string, fileName: string) {
    const url = await generateDownloadUrl({ storageKey });
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Files</h1>
        <p className="text-muted-foreground">
          Upload files via drag & drop or click to browse.
        </p>
      </div>

      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          relative cursor-pointer rounded-lg border-2 border-dashed p-8
          transition-colors duration-200 text-center
          ${dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }
          ${uploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          disabled={uploading}
        />
        <div className="flex flex-col items-center gap-2">
          <div className={`rounded-full p-3 ${dragOver ? "bg-primary/10" : "bg-muted"}`}>
            <Upload className={`h-6 w-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
          </div>
          {uploading ? (
            <>
              <p className="text-sm font-medium">Uploading... {progress}%</p>
              <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-medium">
                {dragOver ? "Drop file here" : "Drag & drop a file here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
            </>
          )}
        </div>
      </div>

      {/* File list */}
      {files === undefined ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No files yet. Upload one above!
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <Card key={file._id} className="animate-fade-in">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{file.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatBytes(file.size)}</span>
                        <Badge variant="secondary" className="text-xs">
                          {file.fileType}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {file.storageKey && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(file.storageKey!, file.fileName)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteFileMutation({ fileId: file._id })}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

Changes from current:
- Replaced `storeMetadata` with `createPendingFile` + `confirmUpload`
- Three-step upload flow: create pending → upload to R2 → confirm
- Download button only shows when `storageKey` exists (guard for type safety)
- Removed unused `storeFileMetadata` mutation import

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`

Expected: PASS

- [ ] **Step 3: Run lint**

Run: `bun run lint`

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/_app/files.tsx
git commit -m "feat: update frontend to three-step upload flow with pending status"
```

---

### Task 5: Full Verification

**Files:** None (testing only)

- [ ] **Step 1: Run full test suite**

Run: `bun run test`

Expected: All tests pass.

- [ ] **Step 2: Run typecheck + lint**

Run: `bun run typecheck && bun run lint`

Expected: Both pass.

- [ ] **Step 3: Commit spec document**

```bash
git add docs/superpowers/specs/2026-04-03-upload-reliability-design.md
git commit -m "docs: add upload reliability design spec"
```
