// Cloudflare Pages Function — proxies /api/auth/* to Convex HTTP backend.
// This keeps auth cookies on the same origin (no cross-origin cookie issues).

export const onRequest: PagesFunction<{
  CONVEX_SITE_URL: string;
}> = async ({ request, env }) => {
  const url = new URL(request.url);
  const target = new URL(url.pathname + url.search, env.CONVEX_SITE_URL);

  const res = await fetch(target.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.method !== "GET" ? request.body : undefined,
  });

  return new Response(res.body, {
    status: res.status,
    headers: res.headers,
  });
};
