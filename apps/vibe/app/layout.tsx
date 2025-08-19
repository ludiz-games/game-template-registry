import { SandboxState } from "@/components/modals/sandbox-state";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import type { Metadata } from "next";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vercel Vibe Coding Agent",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster />
          <SandboxState />
        </Providers>
      </body>
    </html>
  );
}
