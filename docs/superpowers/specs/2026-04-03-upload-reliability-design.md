# Upload Reliability: Pending/Complete Status with Cron Cleanup

**Date:** 2026-04-03
**Status:** Approved
**Goal:** Add two-phase upload tracking (pending → complete) with automatic cleanup of orphaned uploads.

## Problem

If a user starts an upload but never finishes (tab closes, network drops), the current flow can leave:
- An R2 object with no metadata record (upload succeeded, storeFileMetadata never called)
- No way to detect or clean up orphaned files

## Solution

Create a `pending` record before upload starts. Only mark `complete` after the R2 upload succeeds. A cron job cleans up anything stuck in `pending` too long.

## Schema Change

Add two `v.optional()` fields to the existing `fileMetadata` table (backwards-compatible with existing records):

```
fileMetadata
├── fileName     (string)           — existing
├── storageKey   (string)           — existing
├── mimeType     (string)           — existing
├── size         (number)           — existing
├── fileType     (audio|document|image) — existing
├── createdBy    (id<users>)        — existing
├── createdAt    (number)           — existing
├── status       (optional: "pending" | "complete")  — NEW
└── updatedAt    (optional: number)                  — NEW
```

New index: `by_status` on `["status"]` for the cron query.

Existing records (no `status` field) are treated as `complete` by the query filter.

## Upload Flow (Before → After)

**Before:**
```
uploadFile(file) → storeFileMetadata({storageKey, ...})
```

**After:**
```
createPendingFile({fileName, size, mimeType, fileType})
  → returns {fileId, storageKey}    // storageKey generated server-side
uploadFile(file, storageKey)         // upload to R2 using generated key
confirmUpload({fileId})              // pending → complete
```

If upload fails or is abandoned, the pending record gets cleaned up by cron.

## Functions

### New: `createPendingFile` (userMutation)

- Args: `{ fileName, size, mimeType, fileType }`
- Generates a deterministic `storageKey` (e.g., `uploads/{userId}/{timestamp}-{fileName}`)
- Inserts record with `status: "pending"`, `createdAt: Date.now()`, `updatedAt: Date.now()`
- Returns `{ fileId, storageKey }`

### New: `confirmUpload` (userMutation)

- Args: `{ fileId }`
- Validates: record exists, `createdBy === ctx.user._id`, `status === "pending"`
- Updates: `status: "complete"`, `updatedAt: Date.now()`

### Modified: `getMyFiles` (userQuery)

- Existing filter by `createdBy` stays
- Adds: exclude records where `status === "pending"`
- Treats records with no `status` field (existing data) as complete

### Modified: `storeFileMetadata` (userMutation)

- Keep for backwards compatibility (the `@convex-dev/r2` `syncMetadata` flow still uses it)
- No changes needed — new uploads use `createPendingFile` + `confirmUpload` instead

### New: `cleanupOrphans` (action in `convex/storage/files.ts`)

- Internal action (not exposed to clients)
- Queries `pending` records older than 30 minutes
- For each: calls `r2.deleteObject()` to remove R2 file, then deletes the DB record
- Logs count of cleaned records

### New: `convex/crons.ts`

- Runs `cleanupOrphans` every 30 minutes

## Frontend Change

`src/routes/_app/files.tsx` `handleUpload` changes from two-step to three-step:

```tsx
// 1. Create pending record (get storageKey from server)
const { fileId } = await createPendingFile({
  fileName: file.name,
  size: file.size,
  mimeType: file.type || "application/octet-stream",
  fileType: getFileType(file.type),
});

// 2. Upload to R2 (existing hook)
await uploadFile(file, { onProgress });

// 3. Confirm upload
await confirmUpload({ fileId });
```

Note: The `uploadFile` hook from `@convex-dev/r2` generates its own storageKey internally. The `createPendingFile` mutation needs to receive the storageKey after upload, so the flow is actually:

```tsx
// 1. Create pending record (without storageKey yet)
const fileId = await createPendingFile({
  fileName: file.name,
  size: file.size,
  mimeType: file.type || "application/octet-stream",
  fileType: getFileType(file.type),
});

// 2. Upload to R2 (returns storageKey)
const storageKey = await uploadFile(file, { onProgress });

// 3. Confirm upload (attach storageKey + flip status)
await confirmUpload({ fileId, storageKey });
```

## Tests

Add to `tests/convex/storage/files.test.ts`:

1. **"pending files are not visible in getMyFiles"** — create pending file, verify getMyFiles returns empty
2. **"confirmed files are visible in getMyFiles"** — create pending, confirm, verify visible
3. **"only file owner can confirm upload"** — user A creates pending, user B tries to confirm → error
4. **"existing records without status still appear"** — insert legacy record (no status field), verify it appears in getMyFiles

## Files Summary

| Action | File |
|--------|------|
| Modify | `convex/schema.ts` — add status + updatedAt fields, by_status index |
| Modify | `convex/storage/files.ts` — add createPendingFile, confirmUpload, cleanupOrphans; modify getMyFiles |
| Create | `convex/crons.ts` — 30-min cleanup schedule |
| Modify | `src/routes/_app/files.tsx` — three-step upload flow |
| Modify | `tests/convex/storage/files.test.ts` — pending/complete lifecycle tests |

## Out of Scope

- Retry logic for failed uploads (user can just re-upload)
- Upload progress persistence across page reloads
- Multi-file upload UI
- File size limits or type restrictions
