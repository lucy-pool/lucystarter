#!/bin/bash
# Block using sed -i / awk for file editing — use the Edit tool instead
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Block sed with -i flag (in-place editing)
if echo "$COMMAND" | grep -qE '\bsed\s+-i'; then
  echo "Blocked: Use the Edit tool instead of sed -i for editing files." >&2
  exit 2
fi

# Block awk with output redirection or -i inplace (gawk)
if echo "$COMMAND" | grep -qE '\bawk\b.*>'; then
  echo "Blocked: Use the Edit tool instead of awk for editing files." >&2
  exit 2
fi

exit 0
