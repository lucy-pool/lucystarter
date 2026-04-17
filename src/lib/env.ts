// Fail-fast server-side env validation.
//
// Runs at module load inside the Worker. Missing vars throw a clear
// message here instead of surfacing as a generic HTTPError deep inside
// Better Auth or Convex on the first request.
//
// Client-side (router.tsx) reads the same URLs via `import.meta.env`,
// so keep this file server-only — do not import from browser code.

const required = ["VITE_CONVEX_URL", "VITE_CONVEX_SITE_URL"] as const;

for (const k of required) {
  if (!process.env[k]) {
    throw new Error(
      `Missing env var ${k}. Set via \`wrangler deploy --var\` ` +
        "or locally in .env.local. (read by src/lib/auth-server.ts)",
    );
  }
}

export const env = {
  VITE_CONVEX_URL: process.env.VITE_CONVEX_URL!,
  VITE_CONVEX_SITE_URL: process.env.VITE_CONVEX_SITE_URL!,
};
