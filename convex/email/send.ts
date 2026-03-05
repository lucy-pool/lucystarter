import { internal } from "../_generated/api";
import { v } from "convex/values";
import { emailTemplateValidator } from "../schema";
import { userMutation, adminMutation } from "../functions";

// ── User-facing mutations ───────────────────────────────────────────

/** Send an email (auth-gated). Creates a log and schedules delivery. */
export const sendEmail = userMutation({
  args: {
    to: v.string(),
    template: emailTemplateValidator,
    templateData: v.string(),
    customTemplateId: v.optional(v.id("emailTemplates")),
  },
  returns: v.id("emailLogs"),
  handler: async (ctx, args) => {
    const logId = await ctx.db.insert("emailLogs", {
      to: args.to,
      subject: "", // Will be set by the action after rendering
      template: args.template,
      templateData: args.templateData,
      status: "queued",
      sentBy: ctx.user._id,
      customTemplateId: args.customTemplateId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.email.actions.processEmail, {
      logId,
    });

    return logId;
  },
});

/** Resend a failed email (admin only). Creates a new log from the old one. */
export const resendEmail = adminMutation({
  args: { logId: v.id("emailLogs") },
  returns: v.id("emailLogs"),
  handler: async (ctx, args) => {
    const oldLog = await ctx.db.get(args.logId);
    if (!oldLog) throw new Error("Email log not found");

    const newLogId = await ctx.db.insert("emailLogs", {
      to: oldLog.to,
      subject: "",
      template: oldLog.template,
      templateData: oldLog.templateData,
      status: "queued",
      sentBy: ctx.user._id,
      customTemplateId: oldLog.customTemplateId,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(0, internal.email.actions.processEmail, {
      logId: newLogId,
    });

    return newLogId;
  },
});
