"use client";

import { useAuthToken } from "@convex-dev/auth/react";
import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode, useMemo } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function useAuth() {
  const token = useAuthToken();
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: token !== null,
      fetchAccessToken: async () => token,
    }),
    [token],
  );
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithAuth client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithAuth>
  );
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  );
}
