#!/bin/bash
# Block --no-verify flag — don't bypass safety checks
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE '\-\-no-verify'; then
  echo "Blocked: Do not use --no-verify. Fix the underlying issue instead of bypassing safety checks." >&2
  exit 2
fi

exit 0
