#!/bin/bash
# Block npm/yarn/npx — this project uses bun/bunx exclusively
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE '\bnpm\s+'; then
  echo "Blocked: Use bun instead of npm. This project uses bun exclusively." >&2
  exit 2
fi

if echo "$COMMAND" | grep -qE '\byarn\s+'; then
  echo "Blocked: Use bun instead of yarn. This project uses bun exclusively." >&2
  exit 2
fi

# Block npx but not bunx
if echo "$COMMAND" | grep -qE '\bnpx\s+'; then
  echo "Blocked: Use bunx instead of npx. This project uses bun exclusively." >&2
  exit 2
fi

exit 0
