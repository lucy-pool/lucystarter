---
name: greybox-review
description: On-demand architectural audit using the Greybox Principle. Analyzes module depth, opacity, and temporal coupling.
trigger: greybox review, module depth check, architecture audit, check module boundaries
---

# Greybox Review

Architectural audit skill that evaluates modules against the Greybox Principle ("Accessible but Irrelevant").

## Steps

### 1. Load the Checklist

Read `docs/design/greybox_principle.md` for the full Greybox Principle reference.

### 2. Identify Target Module(s)

If the user specified a module, use that. Otherwise, audit all deep modules under `convex/` (e.g., `convex/email/`, `convex/storage/`, `convex/ai/`).

### 3. Depth Score

For each module, evaluate:

- **Interface complexity:** Count exported functions (the public API surface).
- **Implementation complexity:** Count internal files, helper functions, and lines of code.
- **Score:** A deep module has few exports relative to many internal lines. Report as `{exports} exports / {internal_files} files / ~{lines} lines`.
- **Verdict:** "Deep" (good), "Balanced", or "Shallow" (needs consolidation).

### 4. Opacity Assessment

For each module, check:

- Do any files outside the module import internal (non-exported) helpers?
- Do consumers reference internal types, schemas, or constants that should be hidden?
- Could you swap the internal implementation (e.g., switch email provider) without changing any consumer?
- **Verdict:** "Opaque" (good), "Leaky" (some internals exposed), or "Transparent" (consumers depend on internals).

### 5. Temporal Coupling Analysis

Run this command to find files that change together:

```bash
git log --name-only --pretty=format:"---COMMIT---" -50 | awk '
  /^---COMMIT---$/ { if (n > 0) { for (i in files) for (j in files) if (i < j) pairs[i","j]++; } delete files; n=0; next }
  /^$/ { next }
  { files[$0]=1; n++ }
  END { for (i in files) for (j in files) if (i < j) pairs[i","j]++; for (p in pairs) if (pairs[p] >= 3) print pairs[p] "\t" p }
' | sort -rn | head -20
```

From the results:
- Identify file pairs that live in **different** top-level modules (e.g., `convex/ai/` and `convex/storage/`).
- These are candidates for boundary reassignment.
- Pairs within the same module are fine (expected coupling).

### 6. Report Format

Present findings as:

```
## Greybox Audit: [Module Name]

**Depth:** {score} — {verdict}
  {exports} exports, {files} internal files, ~{lines} lines

**Opacity:** {verdict}
  {details about any leakage found}

**Temporal Coupling:** {any cross-module pairs}
  {file1} <-> {file2} (changed together in {n} of last 50 commits)

**Recommendations:**
- {specific actionable suggestions}
```

### 7. Recommendations

Based on findings, suggest:
- **Shallow modules:** Consolidate files, reduce exports, or merge with related modules.
- **Leaky modules:** Move leaked internals behind the public API, use re-exports.
- **Coupled across boundaries:** Consider merging modules or extracting a shared deep module.
- **No issues:** Confirm the module follows the Greybox Principle well.
