import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextFetchEvent, NextRequest } from "next/server";

const isPublicRoute = createRouteMatcher(["/", "/signin", "/signup", "/forgot-password", "/api/auth(.*)"]);

const handler = convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  if (!isPublicRoute(request) && !(await convexAuth.isAuthenticated())) {
    return nextjsMiddlewareRedirect(request, "/signin");
  }
});

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  // Behind Cloudflare/Traefik, request.url is http:// but Origin is https://.
  // Fix the protocol so the CORS check in convex-auth doesn't reject same-site requests.
  const origin = request.headers.get("origin");
  if (origin && request.url.startsWith("http://")) {
    const originUrl = new URL(origin);
    if (originUrl.host === request.headers.get("host")) {
      const url = new URL(request.url);
      url.protocol = originUrl.protocol;
      url.port = "";
      return handler(new NextRequest(url, request), event);
    }
  }
  return handler(request, event);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
