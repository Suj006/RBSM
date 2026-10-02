import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SignupForm } from "@/components/auth/signup-form";
import { EVENT } from "@/lib/config";

export const metadata: Metadata = { title: "Buyer registration" };

export default function SignupPage() {
  return (
    <>
      <Link href="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-brand-700">
        <ArrowLeft className="size-4" /> Back to home
      </Link>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-brand-700">International buyers</div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">Register for {EVENT.name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Three quick details to create your buyer account. You&apos;ll complete your profile after signing in.
        </p>
      </div>
      <SignupForm />
    </>
  );
}
