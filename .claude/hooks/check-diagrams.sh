#!/bin/bash
# PreToolUse hook: validate diagrams are up-to-date before git commit.
# BLOCKING — if diagrams are stale, spawns a fixer agent and blocks the commit.

# Read stdin (JSON with tool input)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')

# Only act on git commit commands
case "$COMMAND" in
  git\ commit*) ;;
  *) exit 0 ;;
esac

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DIAGRAM_DIR="$PROJECT_ROOT/memory/ai/diagrams"

# Skip if diagram directory doesn't exist
[ -d "$DIAGRAM_DIR" ] || exit 0

# Get staged files (these are what's being committed)
STAGED_FILES=$(cd "$PROJECT_ROOT" && git diff --cached --name-only 2>/dev/null)
[ -z "$STAGED_FILES" ] && exit 0

# Pattern map: source file patterns → diagram files they affect
# Mirrors DIAGRAM_MAPPINGS from stop-hook.ts
check_affected() {
  local file="$1"
  case "$file" in
    convex/schema.ts) echo "schema.md" ;;
    convex/*.ts|convex/*.tsx) echo "functions.md data-flow.md" ;;
    convex/email/*|convex/storage/*|convex/ai/*) echo "functions.md data-flow.md greybox.md" ;;
    convex/auth.ts|convex/auth.config.ts|convex/users.ts) echo "auth-flow.md" ;;
    convex/functions.ts|convex/authHelpers.ts) echo "greybox.md" ;;
    src/proxy.ts|src/components/providers.tsx) echo "auth-flow.md" ;;
    src/app/*/page.tsx|src/components/*.tsx) echo "data-flow.md" ;;
  esac
}

# Collect which diagrams should be affected by this commit
AFFECTED=""
while IFS= read -r file; do
  AFFECTED="$AFFECTED $(check_affected "$file")"
done <<< "$STAGED_FILES"

# Deduplicate
AFFECTED=$(echo "$AFFECTED" | tr ' ' '\n' | sort -u | grep -v '^$')
[ -z "$AFFECTED" ] && exit 0

# Check if any affected diagrams are NOT staged (i.e. stale or missing from commit)
STALE=""
for diagram in $AFFECTED; do
  DIAGRAM_PATH="memory/ai/diagrams/$diagram"
  # Check if the diagram file has unstaged changes or doesn't exist
  if [ ! -f "$PROJECT_ROOT/$DIAGRAM_PATH" ]; then
    STALE="$STALE $diagram(missing)"
  elif cd "$PROJECT_ROOT" && git diff --name-only "$DIAGRAM_PATH" 2>/dev/null | grep -q .; then
    # Diagram has unstaged modifications — the stop hook updated it but it wasn't staged
    STALE="$STALE $diagram(unstaged)"
  elif cd "$PROJECT_ROOT" && ! git diff --cached --name-only "$DIAGRAM_PATH" 2>/dev/null | grep -q .; then
    # Diagram exists and is clean, but source files changed — may be out of date
    # Check if diagram was modified more recently than 60s ago (recently updated by stop hook)
    DIAGRAM_MTIME=$(stat -f %m "$PROJECT_ROOT/$DIAGRAM_PATH" 2>/dev/null || echo 0)
    NOW=$(date +%s)
    AGE=$(( NOW - DIAGRAM_MTIME ))
    if [ "$AGE" -gt 300 ]; then
      STALE="$STALE $diagram(outdated)"
    fi
  fi
done

STALE=$(echo "$STALE" | xargs)
[ -z "$STALE" ] && exit 0

# Diagrams need updating — spawn fixer agent and block
echo "" >&2
echo "⚠ Stale diagrams detected: $STALE" >&2
echo "  Spawning diagram updater to fix before commit..." >&2
echo "" >&2

# Build the list of changed source files for the prompt
CHANGED_SRC=$(echo "$STAGED_FILES" | grep -v '^memory/ai/diagrams/' | tr '\n' ', ' | sed 's/,$//')
STALE_LIST=$(echo "$STALE" | tr ' ' ', ')

claude -p --model sonnet "The following source files are being committed: $CHANGED_SRC. These diagrams need updating: $STALE_LIST. Read each affected diagram in memory/ai/diagrams/ and the relevant source files, then update the diagrams to reflect the current code. Do NOT commit. Leave changes as unstaged files." >&2

# After the fixer runs, stage the updated diagrams
for diagram in $AFFECTED; do
  DIAGRAM_PATH="memory/ai/diagrams/$diagram"
  if [ -f "$PROJECT_ROOT/$DIAGRAM_PATH" ]; then
    cd "$PROJECT_ROOT" && git add "$DIAGRAM_PATH" 2>/dev/null
  fi
done

echo "" >&2
echo "✓ Diagrams updated and staged. Proceeding with commit." >&2
echo "" >&2

exit 0
