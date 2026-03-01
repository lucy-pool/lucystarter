import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ── Role values ─────────────────────────────────────────────────────
// Update these when you add your own roles.
export const ROLES = ["user", "admin"] as const;
export const roleValidator = v.union(
  v.literal("user"),
  v.literal("admin")
);

// ── File type values ────────────────────────────────────────────────
export const fileTypeValidator = v.union(
  v.literal("audio"),
  v.literal("document"),
  v.literal("image")
);

// ── Message role values ─────────────────────────────────────────────
export const messageRoleValidator = v.union(
  v.literal("user"),
  v.literal("assistant")
);

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.optional(v.string()),
    email: v.string(),
    avatarUrl: v.optional(v.string()),
    roles: v.array(roleValidator),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // ── File storage metadata ───────────────────────────────────────
  // Actual files live in Cloudflare R2. This table tracks metadata only.
  fileMetadata: defineTable({
    fileName: v.string(),
    storageKey: v.string(),
    mimeType: v.string(),
    size: v.number(),
    fileType: fileTypeValidator,
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_created_by", ["createdBy"])
    .index("by_file_type", ["fileType"]),

  // ── AI chat messages ────────────────────────────────────────────
  // Stores conversation history for the AI chat demo.
  aiMessages: defineTable({
    userId: v.id("users"),
    role: messageRoleValidator,
    content: v.string(),
    model: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"]),

  // ── Demo table — replace with your own ──────────────────────────
  // Shows the basic pattern: table + indexes + validators.
  // Delete this and add your own tables.
  notes: defineTable({
    title: v.string(),
    body: v.string(),
    authorId: v.id("users"),
    isPublic: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_author", ["authorId"])
    .index("by_public", ["isPublic"]),
});
