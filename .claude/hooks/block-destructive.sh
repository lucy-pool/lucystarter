#!/bin/bash
# Block destructive commands — rm -rf, git reset --hard, git push --force
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE '\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive\s+--force|-[a-zA-Z]*f[a-zA-Z]*r)\b'; then
  echo "Blocked: rm -rf is not allowed. Remove files individually or ask the user for confirmation." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+reset\s+--hard\b'; then
  echo "Blocked: git reset --hard is destructive. Use a safer alternative." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\bgit\s+push\s+.*--force\b|\bgit\s+push\s+-f\b'; then
  echo "Blocked: git push --force is destructive. Use --force-with-lease if you must force push." >&2
  exit 2
fi

exit 0
