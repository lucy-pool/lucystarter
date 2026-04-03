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
