"use client";

import { SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { APP_NAME } from "@/lib/utils";

export default function Home() {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) {
      router.replace("/dashboard");
    }
  }, [isSignedIn, router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primary px-6">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold text-primary-foreground tracking-tight sm:text-5xl">
          {APP_NAME}
        </h1>
        <p className="mt-4 text-lg text-primary-foreground/70">
          Your starter template with Convex, Next.js, and Clerk
        </p>

        <SignedOut>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-in"
              className="w-full sm:w-auto rounded-md bg-white px-6 py-3 text-primary font-medium hover:bg-white/90 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="w-full sm:w-auto rounded-md border border-primary-foreground/30 px-6 py-3 text-primary-foreground hover:bg-primary-foreground/10 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="mt-10">
            <Link
              href="/dashboard"
              className="rounded-md bg-white px-8 py-3 text-primary font-medium hover:bg-white/90 transition-colors"
            >
              Go to Dashboard
            </Link>
          </div>
        </SignedIn>
      </div>
    </div>
  );
}
