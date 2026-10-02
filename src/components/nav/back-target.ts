/** Detail pages are reached from several lists; "back" returns to whichever one the user came from. */
export function backFor(base: string, label: string) {
  const root = base.slice(0, base.lastIndexOf("/"));
  return {
    href: base, label,
    from: [
      { href: root, label: "Back to dashboard" },
      { href: `${root}/buyers`, label: "Back to buyers" },
      { href: `${root}/requirements`, label: "Back to sector requirements" },
      { href: `${root}/approved`, label: "Back to approved buyers" },
      { href: `${root}/sellers`, label: "Back to sellers" },
      { href: `${root}/demand`, label: "Back to sector demand" },
      { href: `${root}/demand/`, label: "Back to sector demand" },
    ],
  };
}
