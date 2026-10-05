"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui";

type Opt = { id: string; label: string };

/** Choose one buyer or one seller; posts buyerId or sellerId. */
export function RecipientPicker({ buyers, sellers }: { buyers: Opt[]; sellers: Opt[] }) {
  const [who, setWho] = useState<"buyer" | "seller">("buyer");
  const list = who === "buyer" ? buyers : sellers;
  return (
    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <Field label="Send to" htmlFor="who">
        <Select id="who" value={who} onChange={(e) => setWho(e.target.value as "buyer" | "seller")}>
          <option value="buyer">A buyer</option>
          <option value="seller">An approved seller</option>
        </Select>
      </Field>
      <Field label={who === "buyer" ? "Buyer" : "Seller"} htmlFor="recipient" required>
        <Select key={who} id="recipient" name={who === "buyer" ? "buyerId" : "sellerId"} defaultValue="">
          <option value="">Choose…</option>
          {list.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </Select>
      </Field>
    </div>
  );
}
