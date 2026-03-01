"use client";

import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { AppShell } from "@/components/layout/app-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const getOrCreateUser = useMutation(api.users.getOrCreateUser);
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  useEffect(() => {
    if (isAuthenticated) {
      getOrCreateUser().catch(() => {
        // User provisioning failed - will retry on next mount
      });
    }
  }, [isAuthenticated, getOrCreateUser]);

  if (isLoading || !isAuthenticated || user === undefined || user === null) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
