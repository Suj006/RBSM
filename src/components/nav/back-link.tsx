"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Client-side navigation does not update document.referrer, so the portal keeps
// its own short trail in sessionStorage: the previous page, and the last URL
// (with filters) seen for every path.
const PREV = "nav:prev";
const CUR = "nav:cur";
const seen = (path: string) => `nav:seen:${path}`;

function read(key: string) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

/** Mounted once in the app shell; records where the user has been. */
export function NavTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    try {
      const url = pathname + (search ? `?${search}` : "");
      const cur = sessionStorage.getItem(CUR);
      if (cur && new URL(cur, location.origin).pathname !== pathname) sessionStorage.setItem(PREV, cur);
      sessionStorage.setItem(CUR, url);
      sessionStorage.setItem(seen(pathname), url);
    } catch { /* storage unavailable: back links fall back to plain hrefs */ }
  }, [pathname, search]);
  return null;
}

type Target = { href: string; label: string };

/**
 * Back link to the page the user came from, when that is one of the expected
 * parents (`href` or `from`), keeping its filters and page number; otherwise
 * the default parent `href`, with the filters last used there. A `from` href
 * ending in "/" matches any page below it.
 */
export function BackLink({ href, label, from = [] }: Target & { from?: Target[] }) {
  const [target, setTarget] = useState<Target>({ href, label });
  useEffect(() => {
    // The tracker may not have recorded this page yet (effect order on first load):
    // then the last recorded page is the one we came from.
    const cur = read(CUR);
    const prev = cur && new URL(cur, location.origin).pathname !== location.pathname ? cur : read(PREV);
    const prevPath = prev ? new URL(prev, location.origin).pathname : null;
    // A `from` href ending in "/" matches any page below it (e.g. "/dic/demand/").
    const match = prevPath ? [{ href, label }, ...from].find((t) => (t.href.endsWith("/") ? prevPath.startsWith(t.href) : t.href === prevPath)) : undefined;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is only readable after mount
    setTarget(match && prev ? { href: prev, label: match.label } : { href: read(seen(href)) ?? href, label });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, label]);
  return (
    <Link href={target.href} className="no-print mb-4 inline-flex items-center gap-1.5 rounded-lg py-1 pr-2 text-sm font-medium text-slate-500 hover:text-brand-700">
      <ArrowLeft className="size-4" /> {target.label}
    </Link>
  );
}
