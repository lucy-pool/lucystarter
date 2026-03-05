#!/bin/bash
# Block using cat/head/tail for reading files — use the Read tool instead
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Match cat/head/tail as the first command (before any pipe)
FIRST_CMD=$(echo "$COMMAND" | sed 's/|.*//' | xargs)

if echo "$FIRST_CMD" | grep -qE '^\s*(cat|head|tail)\s+'; then
  echo "Blocked: Use the Read tool instead of cat/head/tail to read files." >&2
  exit 2
fi

exit 0
