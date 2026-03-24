import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useSession } from "@/lib/auth-client";
import { AppShell } from "@/components/layout/app-shell";
import { useEffect, useRef } from "react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { data: session, isPending } = useSession();
  const user = useQuery(
    api.users.getCurrentUser,
    session ? {} : "skip",
  );
  const provisionUser = useMutation(api.users.provisionUser);
  const provisioning = useRef(false);

  // Auto-provision app user record when Better Auth session exists
  // but no app user record found yet.
  useEffect(() => {
    if (session && user === null && !provisioning.current) {
      provisioning.current = true;
      provisionUser().finally(() => {
        provisioning.current = false;
      });
    }
  }, [session, user, provisionUser]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    window.location.href = "/signin";
    return null;
  }

  if (user === undefined || user === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
