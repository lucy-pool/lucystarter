"use client";

import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Zap, Shield, Cloud, TrendingUp, ArrowRight } from "lucide-react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeToggle } from "@/components/theme-toggle";

const heading = Plus_Jakarta_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  return (
    <>
      <style>{`
        @keyframes landing-float1 {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50% { transform: translateY(-12px) rotate(-1.5deg); }
        }
        @keyframes landing-float2 {
          0%, 100% { transform: translateY(0) rotate(2deg); }
          50% { transform: translateY(-10px) rotate(3.5deg); }
        }
        @keyframes landing-float3 {
          0%, 100% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-14px) rotate(0.5deg); }
        }
      `}</style>

      <div className="min-h-screen">
        {/* Full-bleed container */}
        <div
          className="relative min-h-screen overflow-hidden"
          style={{
            background:
              "linear-gradient(180deg, #dbe8f4 0%, #efd8e6 25%, #f5f0ea 50%, #e8e4d8 100%)",
          }}
        >
          {/* Dark mode gradient overlay */}
          <div
            className="pointer-events-none absolute inset-0 hidden dark:block"
            style={{
              background:
                "linear-gradient(180deg, #0C0C12 0%, #12101a 25%, #0C0C12 50%, #101210 100%)",
            }}
          />

          {/* ── Content ── */}
          <div className="relative z-10">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 sm:px-10 py-5">
              <span className="text-lg font-semibold tracking-tight text-[#29292C] dark:text-white">
                {APP_NAME}
              </span>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <Unauthenticated>
                  <Button
                    asChild
                    variant="ghost"
                    className="rounded-full border border-[#29292C]/15 dark:border-white/20 bg-transparent hover:bg-[#29292C]/5 dark:hover:bg-white/10 text-[#29292C] dark:text-white px-5"
                  >
                    <Link href="/signin">Sign in</Link>
                  </Button>
                  <Button
                    asChild
                    className="rounded-full bg-[#29292C] dark:bg-white text-white dark:text-[#29292C] hover:bg-[#3a3a3e] dark:hover:bg-white/90 px-5"
                  >
                    <Link href="/signup">Sign up</Link>
                  </Button>
                </Unauthenticated>
                <Authenticated>
                  <Button
                    asChild
                    className="rounded-full bg-[#29292C] dark:bg-white text-white dark:text-[#29292C] hover:bg-[#3a3a3e] dark:hover:bg-white/90 px-5"
                  >
                    <Link href="/dashboard">Dashboard</Link>
                  </Button>
                </Authenticated>
              </div>
            </nav>

            {/* Hero */}
            <div className="text-center pt-12 sm:pt-20 pb-44 sm:pb-56 px-6">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/40 dark:border-white/10 px-1 py-1 pr-4 mb-8">
                <span className="rounded-full bg-[#F77B07] px-3 py-0.5 text-xs font-medium text-white">
                  {APP_NAME}
                </span>
                <span className="text-sm text-[#29292C]/70 dark:text-white/70">
                  Ship your next project faster
                </span>
              </div>

              <h1
                className={`${heading.className} text-[2.5rem] sm:text-6xl md:text-7xl font-bold leading-[1.1] text-[#29292C] dark:text-white max-w-4xl mx-auto tracking-tight`}
              >
                Build and Ship Your
                <br />
                Next App with {APP_NAME}
              </h1>

              <p className={`${heading.className} mt-5 text-base sm:text-lg text-[#29292C]/60 dark:text-white/50 max-w-xl mx-auto`}>
                A production-ready starter with real-time data, authentication,
                file storage, and AI — everything you need to launch.
              </p>

              {/* CTA row */}
              <div className="mt-8 flex items-center justify-center gap-4 flex-wrap">
                <Unauthenticated>
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-[#29292C] dark:bg-white text-white dark:text-[#29292C] hover:bg-[#3a3a3e] dark:hover:bg-white/90 px-8 h-12 text-base"
                  >
                    <Link href="/signup">
                      Get Started <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </Unauthenticated>
                <Authenticated>
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full bg-[#29292C] dark:bg-white text-white dark:text-[#29292C] hover:bg-[#3a3a3e] dark:hover:bg-white/90 px-8 h-12 text-base"
                  >
                    <Link href="/dashboard">
                      Go to Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </Authenticated>

                <div className="flex items-center gap-2 rounded-full bg-white/60 dark:bg-white/10 backdrop-blur-sm border border-white/30 dark:border-white/10 px-4 py-2">
                  <span className="text-lg font-bold text-[#F77B07]">4</span>
                  <span className="text-xs text-[#29292C]/60 dark:text-white/50 text-left leading-tight">
                    built-in
                    <br />
                    integrations
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Floating cards (desktop only) ── */}
          <div className="hidden lg:block">
            {/* Card 1: Real-time — left */}
            <div
              className="absolute top-[58%] left-[4%] z-[8] w-52 rounded-2xl bg-[#f0ebe0] dark:bg-[#2a2824] border border-[#e0d9c8]/50 dark:border-white/10 p-4 shadow-lg"
              style={{ animation: "landing-float1 6s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-[#29292C]/50 dark:text-white/50" />
                <span className="text-xs font-medium text-[#29292C]/60 dark:text-white/60">
                  Real-time Queries
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-[#29292C] dark:text-white">
                  2.4k
                </span>
                <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
                  <TrendingUp className="h-3 w-3" /> +12.5%
                </span>
              </div>
              <p className="text-[10px] text-[#29292C]/40 dark:text-white/40 mt-1">
                Live subscriptions active
              </p>
            </div>

            {/* Card 2: Auth — right */}
            <div
              className="absolute top-[55%] right-[4%] z-[8] w-56 rounded-2xl bg-[#f0ebe0] dark:bg-[#2a2824] border border-[#e0d9c8]/50 dark:border-white/10 p-4 shadow-lg"
              style={{ animation: "landing-float2 7s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Shield className="h-3.5 w-3.5 text-[#29292C]/50 dark:text-white/50" />
                <span className="text-xs font-medium text-[#29292C]/60 dark:text-white/60">
                  Auth Providers
                </span>
              </div>
              <div className="flex items-center gap-4">
                {/* Mini circular gauge */}
                <div className="relative h-14 w-14 flex-shrink-0">
                  <svg
                    className="h-14 w-14 -rotate-90"
                    viewBox="0 0 56 56"
                  >
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      className="text-[#e0d9c8] dark:text-white/10"
                      strokeWidth="4"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="#F77B07"
                      strokeWidth="4"
                      strokeDasharray={`${0.99 * 2 * Math.PI * 24} ${2 * Math.PI * 24}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#29292C] dark:text-white">
                    3
                  </span>
                </div>
                <div className="space-y-1 text-[10px]">
                  {["Password", "GitHub", "Google"].map((p, i) => (
                    <div key={p} className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 rounded-full bg-[#F77B07]"
                        style={{ opacity: 1 - i * 0.25 }}
                      />
                      <span className="text-[#29292C]/60 dark:text-white/60">
                        {p}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Card 3: Storage — bottom center */}
            <div
              className="absolute bottom-[10%] left-1/2 -translate-x-1/2 z-[8] w-56 rounded-2xl bg-[#f0ebe0] dark:bg-[#2a2824] border border-[#e0d9c8]/50 dark:border-white/10 p-4 shadow-lg"
              style={{ animation: "landing-float3 8s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-3.5 w-3.5 text-[#29292C]/50 dark:text-white/50" />
                <span className="text-xs font-medium text-[#29292C]/60 dark:text-white/60">
                  File Storage
                </span>
                <span className="ml-auto text-[10px] text-green-600 dark:text-green-400">
                  +23%
                </span>
              </div>
              {/* Mini bar chart */}
              <div className="flex items-end gap-1 h-8">
                {[40, 65, 45, 70, 55, 80, 60, 75, 90, 70, 85, 95].map(
                  (h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-sm bg-[#29292C]/15 dark:bg-white/15"
                      style={{ height: `${h}%` }}
                    />
                  ),
                )}
              </div>
              <p className="text-[10px] text-[#29292C]/40 dark:text-white/40 mt-2">
                Direct R2 uploads via presigned URLs
              </p>
            </div>
          </div>

          {/* ── Background image ── */}
          <div className="absolute inset-0 z-[5]">
            <img
              src="/default-background-image.webp"
              alt=""
              className="h-full w-full object-cover object-bottom dark:hidden"
            />
            <img
              src="/default-background-image-dark.webp"
              alt=""
              className="h-full w-full object-cover object-bottom hidden dark:block"
            />
            {/* Fade gradient to blend image into the page */}
            <div
              className="absolute inset-x-0 top-0 h-[60%] pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, #dbe8f4 0%, #efd8e6 30%, transparent 100%)",
              }}
            />
            <div
              className="absolute inset-x-0 top-0 h-[60%] pointer-events-none hidden dark:block"
              style={{
                background:
                  "linear-gradient(180deg, #0C0C12 0%, #12101a 30%, transparent 100%)",
              }}
            />
          </div>
        </div>

      </div>
    </>
  );
}
