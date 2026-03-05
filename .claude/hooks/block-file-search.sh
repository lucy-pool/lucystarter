#!/bin/bash
# Block using find/ls for file searching — use the Glob tool instead
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Match find as the first command
FIRST_CMD=$(echo "$COMMAND" | sed 's/|.*//' | xargs)

if echo "$FIRST_CMD" | grep -qE '^\s*find\s+'; then
  echo "Blocked: Use the Glob tool instead of find for searching files." >&2
  exit 2
fi

if echo "$FIRST_CMD" | grep -qE '^\s*ls\s+'; then
  echo "Blocked: Use the Glob tool instead of ls for listing files." >&2
  exit 2
fi

exit 0
