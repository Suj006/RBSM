"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

/** Refreshes the page data every `seconds` (live monitor); shows when it last refreshed. */
export function AutoRefresh({ seconds = 20 }: { seconds?: number }) {
  const router = useRouter();
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => { router.refresh(); setAt(new Date()); }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500" suppressHydrationWarning>
      <RefreshCw className="size-3.5 animate-spin [animation-duration:3s]" /> Live · refreshes every {seconds}s · updated {at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
    </span>
  );
}
