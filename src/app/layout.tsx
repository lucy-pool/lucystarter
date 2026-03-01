import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider, ThemeProvider } from "@/components/providers";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

// TODO: Change "My App" to your app name (see APP_NAME in src/lib/utils.ts)
export const metadata: Metadata = {
  title: "My App",
  description: "Built with Convex, Next.js, and Clerk",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <ConvexClientProvider>
        <html lang="en" suppressHydrationWarning>
          <body>
            <ThemeProvider>
              {children}
              <Toaster />
            </ThemeProvider>
          </body>
        </html>
      </ConvexClientProvider>
    </ClerkProvider>
  );
}
