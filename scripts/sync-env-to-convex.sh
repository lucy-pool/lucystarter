#!/usr/bin/env bash
# Sync environment variables from .env.local to Convex deployment
#
# Usage: ./scripts/sync-env-to-convex.sh [.env.local]

set -euo pipefail

ENV_FILE="${1:-.env.local}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# Variables that should be set in Convex env
CONVEX_VARS=(
  CLERK_JWT_ISSUER_DOMAIN
  OPENROUTER_API_KEY
  DEFAULT_OPENROUTER_MODEL
  R2_ENDPOINT
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
  R2_BUCKET
)

# Fetch current Convex env into an associative array
declare -A current_env
while IFS='=' read -r key value; do
  [[ -z "$key" ]] && continue
  current_env["$key"]="$value"
done < <(bunx convex env list 2>/dev/null)

echo "Current Convex env:"
echo "-------------------"
if [ ${#current_env[@]} -eq 0 ]; then
  echo "(none)"
else
  for key in "${!current_env[@]}"; do
    echo "  $key=${current_env[$key]}"
  done
fi
echo ""

# Parse .env.local for variables in the allow-list
declare -A local_env
while IFS= read -r line; do
  [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
  key="${line%%=*}"
  value="${line#*=}"
  for var in "${CONVEX_VARS[@]}"; do
    if [ "$key" = "$var" ] && [ -n "$value" ]; then
      local_env["$key"]="$value"
      break
    fi
  done
done < "$ENV_FILE"

# Compare and sync
created=0
updated=0
unchanged=0

echo "Syncing from $ENV_FILE:"
echo "-------------------"

for key in "${!local_env[@]}"; do
  new_value="${local_env[$key]}"
  if [ -z "${current_env[$key]+x}" ]; then
    echo "  + CREATE $key"
    bunx convex env set "$key" "$new_value"
    ((created++))
  elif [ "${current_env[$key]}" != "$new_value" ]; then
    echo "  ~ UPDATE $key"
    bunx convex env set "$key" "$new_value"
    ((updated++))
  else
    echo "  = UNCHANGED $key"
    ((unchanged++))
  fi
done

echo ""
echo "Done — created: $created, updated: $updated, unchanged: $unchanged"
