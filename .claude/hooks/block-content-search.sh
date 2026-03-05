#!/bin/bash
# Block using grep/rg for content search — use the Grep tool instead
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Match grep or rg as the first command (before any pipe)
FIRST_CMD=$(echo "$COMMAND" | sed 's/|.*//' | xargs)

if echo "$FIRST_CMD" | grep -qE '^\s*(grep|rg)\s+'; then
  echo "Blocked: Use the Grep tool instead of grep/rg for searching file contents." >&2
  exit 2
fi

exit 0
