"use client";

import { VercelDashed } from "@/components/icons/vercel-dashed";
import { ToggleWelcome } from "@/components/modals/welcome";
import { cn } from "@/lib/utils";
import { UserButton } from "@daveyplate/better-auth-ui";

interface Props {
  className?: string;
}

export function Header({ className }: Props) {
  return (
    <header className={cn("flex items-center justify-between", className)}>
      <div className="flex items-center">
        <VercelDashed className="ml-1 md:ml-2.5 mr-1.5" />
        <span className="hidden md:inline text-sm uppercase font-mono font-bold tracking-tight">
          OSS Vibe Coding Platform
        </span>
      </div>
      <div className="flex items-center ml-auto space-x-3">
        <ToggleWelcome />
        <UserButton />
      </div>
    </header>
  );
}
